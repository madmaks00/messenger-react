import { create } from 'zustand';
import { type IUser, UserValidator } from '../types/models';
import { userSession } from '../services/userSession';
import { eventBus } from '../services/eventBus';
import { closeLocalDatabase, getLocalDatabase } from '../db/localDb';
import { signalRService } from '../services/signalr.service';

interface AuthState {
  loginUser: Partial<IUser>;
  registerUser: Partial<IUser>;
  currentUser: IUser | null;
  confirmPassword: string;
  isAddingNewAccount: boolean;
  savedAccounts: IUser[];
  isVerificationStep: boolean;
  loginErrorMessage: string;
  registerErrorMessage: string;
  registerFieldErrors: Record<string, string>;
  switchAccountErrorMessage: string;

  // Actions
  setLoginField: (field: keyof IUser, value: any) => void;
  setRegisterField: (field: keyof IUser, value: any) => void;
  setRegisterUserBatch: (fields: Partial<IUser>) => void;
  setConfirmPassword: (val: string) => void;
  openRegistration: () => void;
  closeAccountManagement: () => void;
  clearRegisterFields: () => void;
  checkAuth: (authService: any, userService: any) => Promise<boolean>;
  login: (authService: any, userService: any) => Promise<boolean>;
  requestCodeAndGoToVerification: (authService: any) => Promise<boolean>;
  switchAccount: (targetAccount: IUser, authService: any, userService?: any) => Promise<void>;
  logOut: (authService?: any) => Promise<void>;
  initializeSession: (authResult: { token: string; user: IUser }, userService?: any) => Promise<void>;
}

function extractUserIdFromJwt(jwtToken: string): number {
  try {
    if (!jwtToken || jwtToken.trim().length === 0) return 0;
    const parts = jwtToken.split('.');
    if (parts.length < 2) return 0;

    let payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    switch (payload.length % 4) {
      case 2:
        payload += '==';
        break;
      case 3:
        payload += '=';
        break;
    }

    const decoded = JSON.parse(atob(payload));
    const possibleKeys = [
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier',
      'nameid',
      'sub',
      'id',
      'nameidentifier',
    ];

    for (const key of possibleKeys) {
      if (decoded[key] !== undefined) {
        const id = parseInt(decoded[key], 10);
        if (!isNaN(id) && id > 0) return id;
      }
    }
  } catch {}
  return 0;
}

function loadAccountsFromStorage(): IUser[] {
  try {
    const raw = localStorage.getItem('saved_accounts');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAccountsToStorage(accounts: IUser[]): void {
  try {
    localStorage.setItem('saved_accounts', JSON.stringify(accounts));
  } catch (e) {
    console.error('Ошибка сохранения аккаунтов в localStorage', e);
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  loginUser: { username: '', password: '' },
  registerUser: {
    nickName: '',
    username: '',
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: '',
    description: '',
    birthday: '',
    gender: null,
  },
  currentUser: null,
  confirmPassword: '',
  isAddingNewAccount: false,
  savedAccounts: loadAccountsFromStorage(),
  isVerificationStep: false,
  loginErrorMessage: '',
  registerErrorMessage: '',
  registerFieldErrors: {},
  switchAccountErrorMessage: '',

  setLoginField: (field, value) => {
    set((state) => ({
      loginUser: { ...state.loginUser, [field]: value },
      loginErrorMessage: '',
    }));
  },

  setRegisterField: (field, value) => {
    set((state) => {
      const updatedErrors = { ...state.registerFieldErrors };
      delete updatedErrors[field as string];
      return {
        registerUser: { ...state.registerUser, [field]: value },
        registerFieldErrors: updatedErrors,
        registerErrorMessage: '',
      };
    });
  },

  setRegisterUserBatch: (fields) => {
    set((state) => ({
      registerUser: { ...state.registerUser, ...fields },
      registerErrorMessage: '',
    }));
  },

  setConfirmPassword: (val) =>
    set((state) => {
      const updatedErrors = { ...state.registerFieldErrors };
      delete updatedErrors.confirmPassword;
      return {
        confirmPassword: val,
        registerFieldErrors: updatedErrors,
        registerErrorMessage: '',
      };
    }),

  openRegistration: () =>
    set({
      isAddingNewAccount: true,
      loginErrorMessage: '',
      registerErrorMessage: '',
      registerFieldErrors: {},
    }),

  closeAccountManagement: () => set({ isAddingNewAccount: false }),

  clearRegisterFields: () => {
    set({
      registerUser: {
        nickName: '',
        username: '',
        email: '',
        password: '',
        firstName: '',
        lastName: '',
        phone: '',
        description: '',
        birthday: '',
        gender: null,
      },
      confirmPassword: '',
      registerErrorMessage: '',
      registerFieldErrors: {},
      isVerificationStep: false,
    });
  },

  login: async (authService) => {
    const { loginUser, initializeSession } = get();
    set({ loginErrorMessage: '' });

    try {
      const result = await authService.loginAsync(loginUser.username, loginUser.password);
      if (result.isSuccess) {
        await initializeSession(result);
        set({ loginUser: { username: '', password: '' } });
        return true;
      } else {
        set({ loginErrorMessage: 'Invalid login or password' });
        return false;
      }
    } catch {
      set({ loginErrorMessage: 'An error occurred during login. Please try again.' });
      return false;
    }
  },

  requestCodeAndGoToVerification: async (authService) => {
    const { registerUser, confirmPassword } = get();
    set({ registerErrorMessage: '', registerFieldErrors: {} });

    // Валидация полей через UserValidator (1 в 1 с RegisterUser.Validate() в C#)
    const errors = UserValidator.validate(registerUser);

    if (!registerUser.password || registerUser.password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match!';
    }

    if (Object.keys(errors).length > 0) {
      const firstErrorMessage = Object.values(errors)[0];
      console.warn('[AUTH_VALIDATION_FAILED]', errors);
      set({
        registerFieldErrors: errors,
        registerErrorMessage: firstErrorMessage,
      });
      return false;
    }

    try {
      const { isSuccess, message } = await authService.requestVerificationCodeAsync(
        registerUser.email!,
        registerUser.username!
      );

      if (isSuccess) {
        set({ isVerificationStep: true });
        eventBus.emit('StartEmailVerificationMessage', { user: registerUser });
        return true;
      } else {
        set({ registerErrorMessage: message || 'Failed to send verification code.' });
        return false;
      }
    } catch {
      set({ registerErrorMessage: 'An error occurred. Please try again.' });
      return false;
    }
  },

  checkAuth: async (authService, userService) => {
    let token = localStorage.getItem('jwt_token');

    if (!token) {
      const accounts = get().savedAccounts;
      const lastAccount = accounts[0];
      if (lastAccount && lastAccount.token) {
        token = lastAccount.token;
        localStorage.setItem('jwt_token', token);
      }
    }

    if (!token) {
      eventBus.emit('AuthFailedMessage', undefined);
      return false;
    }

    const userId = extractUserIdFromJwt(token);
    if (userId <= 0) {
      userSession.clear();
      localStorage.removeItem('jwt_token');
      eventBus.emit('AuthFailedMessage', undefined);
      return false;
    }

    userSession.setSession(userId, token);

    try {
      const isValid = await authService.validateTokenAsync();
      if (!isValid) {
        userSession.clear();
        localStorage.removeItem('jwt_token');
        eventBus.emit('AuthFailedMessage', undefined);
        return false;
      }

      const user = await userService.getUserProfileAsync(userId);
      if (user && user.id > 0) {
        user.token = token;
        set({ currentUser: user });

        getLocalDatabase(user.id);

        const accounts = get().savedAccounts;
        const exists = accounts.find((a) => a.id === user.id);
        const updatedAccounts = exists
          ? accounts.map((a) => (a.id === user.id ? { ...user, token } : a))
          : [...accounts, { ...user, token }];

        set({ savedAccounts: updatedAccounts });
        saveAccountsToStorage(updatedAccounts);

        signalRService.initAsync(token).catch((err: any) => {
          console.warn('[AuthStore] Фоновый старт SignalR:', err);
        });

        eventBus.emit('UserProfileUpdatedMessage', { user });
        return true;
      }

      eventBus.emit('AuthFailedMessage', undefined);
      return false;
    } catch (ex) {
      console.error('[AuthStore] Ошибка checkAuth:', ex);
      eventBus.emit('AuthFailedMessage', undefined);
      return false;
    }
  },

  switchAccount: async (targetAccount, authService) => {
    const current = get().currentUser;
    if (!targetAccount || targetAccount.id === current?.id) return;

    set({ switchAccountErrorMessage: '' });

    if (!targetAccount.token) {
      set({ switchAccountErrorMessage: 'Session expired. Please log in again.' });
      return;
    }

    try {
      userSession.setSession(targetAccount.id, targetAccount.token);
      localStorage.setItem('jwt_token', targetAccount.token);

      const isValid = await authService.validateTokenAsync();
      if (!isValid) {
        set({ switchAccountErrorMessage: 'Session expired for this account.' });
        return;
      }

      eventBus.emit('BeforeAccountSwitchMessage', undefined);
      closeLocalDatabase();

      set({ currentUser: targetAccount, isAddingNewAccount: false });
      getLocalDatabase(targetAccount.id);

      eventBus.emit('UserProfileUpdatedMessage', { user: targetAccount });
      eventBus.emit('AccountSwitchedMessage', { nickName: targetAccount.nickName });
    } catch {
      set({ switchAccountErrorMessage: 'Error switching account.' });
    }
  },

  initializeSession: async (result) => {
    const { user, token } = result;
    user.token = token;

    userSession.setSession(user.id, token);
    localStorage.setItem('jwt_token', token);
    getLocalDatabase(user.id);

    const accounts = get().savedAccounts;
    const exists = accounts.find((a) => a.id === user.id);
    const updated = exists
      ? accounts.map((a) => (a.id === user.id ? { ...user, token } : a))
      : [...accounts, { ...user, token }];

    set({ currentUser: user, savedAccounts: updated });
    saveAccountsToStorage(updated);

    eventBus.emit('UserProfileUpdatedMessage', { user });
    eventBus.emit('RegistrationSuccessMessage', undefined);
  },

  logOut: async (authService) => {
    try {
      if (userSession.isAuthenticated && authService) {
        await authService.logoutAsync();
      }
    } catch {} finally {
      closeLocalDatabase();
      userSession.clear();
      localStorage.removeItem('jwt_token');
      set({ currentUser: null });
      eventBus.emit('AuthFailedMessage', undefined);
    }
  },
}));