import { create } from 'zustand';
import { type IUser, UserValidator } from '../types/models';
import { userSession } from '../services/userSession';
import { eventBus } from '../services/eventBus';
import { closeLocalDatabase, getLocalDatabase } from '../db/localDb';

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
  switchAccountErrorMessage: string;

  // Actions
  setLoginField: (field: keyof IUser, value: any) => void;
  setRegisterField: (field: keyof IUser, value: any) => void;
  setConfirmPassword: (val: string) => void;
  openRegistration: () => void;
  closeAccountManagement: () => void;
  clearRegisterFields: () => void;
  checkAuth: (authService: any, userService: any) => Promise<boolean>;
  login: (authService: any, userService: any) => Promise<boolean>;
  requestCodeAndGoToVerification: (authService: any) => Promise<boolean>;
  switchAccount: (targetAccount: IUser, authService: any, userService: any) => Promise<void>;
  logOut: (authService?: any) => Promise<void>;
  initializeSession: (authResult: { token: string; user: IUser }, userService?: any) => Promise<void>;
}

// Парсер токена 1-в-1 как C# ExtractUserIdFromJwt
function extractUserIdFromJwt(jwtToken: string): number {
  try {
    if (!jwtToken || jwtToken.trim().length === 0) return 0;
    const parts = jwtToken.split('.');
    if (parts.length < 2) return 0;

    let payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    switch (payload.length % 4) {
      case 2: payload += '=='; break;
      case 3: payload += '='; break;
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
  } catch {
    // игнорируем ошибку парсинга некорректного токена
  }
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
    description: '',
    phone: '',
    birthday: '',
  },
  currentUser: null,
  confirmPassword: '',
  isAddingNewAccount: false,
  savedAccounts: loadAccountsFromStorage(),
  isVerificationStep: false,
  loginErrorMessage: '',
  registerErrorMessage: '',
  switchAccountErrorMessage: '',

  setLoginField: (field, value) => {
    set((state) => ({
      loginUser: { ...state.loginUser, [field]: value },
      loginErrorMessage: '',
    }));
  },

  setRegisterField: (field, value) => {
    set((state) => ({
      registerUser: { ...state.registerUser, [field]: value },
      registerErrorMessage: '',
    }));
  },

  setConfirmPassword: (val) => set({ confirmPassword: val, registerErrorMessage: '' }),
  openRegistration: () => set({ isAddingNewAccount: true, loginErrorMessage: '', registerErrorMessage: '' }),
  closeAccountManagement: () => set({ isAddingNewAccount: false }),

  clearRegisterFields: () => {
    set({
      registerUser: {
        nickName: '',
        username: '',
        email: '',
        password: '',
      },
      confirmPassword: '',
      registerErrorMessage: '',
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
    } catch (ex) {
      set({ loginErrorMessage: 'An error occurred during login. Please try again.' });
      return false;
    }
  },

  requestCodeAndGoToVerification: async (authService) => {
    const { registerUser, confirmPassword } = get();
    set({ registerErrorMessage: '' });

    const errors = UserValidator.validate(registerUser);
    if (Object.keys(errors).length > 0) {
      set({ registerErrorMessage: 'Please fill in all required fields correctly.' });
      return false;
    }

    if (!registerUser.password || registerUser.password !== confirmPassword) {
      set({ registerErrorMessage: 'Passwords do not match!' });
      return false;
    }

    try {
      const { success, errorMsg } = await authService.requestVerificationCodeAsync(
        registerUser.email!,
        registerUser.username!
      );

      if (success) {
        set({ isVerificationStep: true });
        eventBus.emit('StartEmailVerificationMessage', { user: registerUser });
        return true;
      } else {
        set({ registerErrorMessage: errorMsg || 'Failed to send verification code.' });
        return false;
      }
    } catch {
      set({ registerErrorMessage: 'An error occurred. Please try again.' });
      return false;
    }
  },

  checkAuth: async (authService, userService) => {
    const token = localStorage.getItem('jwt_token');
    if (!token) {
      eventBus.emit('AuthFailedMessage', undefined);
      return false;
    }

    const userId = extractUserIdFromJwt(token);
    if (userId <= 0) {
      userSession.clear();
      eventBus.emit('AuthFailedMessage', undefined);
      return false;
    }

    userSession.setSession(userId, token);

    try {
      const isValid = await authService.validateTokenAsync();
      if (!isValid) {
        userSession.clear();
        eventBus.emit('AuthFailedMessage', undefined);
        return false;
      }

      const user = await userService.getUserProfileAsync(userId);
      if (user && user.id > 0) {
        user.token = token;
        set({ currentUser: user });

        // Открываем изолированную IndexedDB
        getLocalDatabase(user.id);

        // Обновляем список сохраненных аккаунтов
        const accounts = get().savedAccounts;
        const exists = accounts.find((a) => a.id === user.id);
        const updatedAccounts = exists
          ? accounts.map((a) => (a.id === user.id ? user : a))
          : [...accounts, user];

        set({ savedAccounts: updatedAccounts });
        saveAccountsToStorage(updatedAccounts);

        eventBus.emit('UserProfileUpdatedMessage', { user });
        return true;
      }

      eventBus.emit('AuthFailedMessage', undefined);
      return false;
    } catch {
      eventBus.emit('AuthFailedMessage', undefined);
      return false;
    }
  },

  switchAccount: async (targetAccount, authService, userService) => {
    const current = get().currentUser;
    if (!targetAccount || targetAccount.id === current?.id) return;

    set({ switchAccountErrorMessage: '' });

    if (!targetAccount.token) {
      set({ switchAccountErrorMessage: 'Session expired. Please log in again.' });
      return;
    }

    try {
      userSession.setSession(targetAccount.id, targetAccount.token);
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
    userSession.setSession(user.id, token);
    getLocalDatabase(user.id);

    const accounts = get().savedAccounts;
    const exists = accounts.find((a) => a.id === user.id);
    const updated = exists ? accounts.map((a) => (a.id === user.id ? user : a)) : [...accounts, user];

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
    } catch {
      // игнорируем ошибку на сервере
    } finally {
      closeLocalDatabase();
      userSession.clear();
      set({ currentUser: null });
      eventBus.emit('AuthFailedMessage', undefined);
    }
  },
}));