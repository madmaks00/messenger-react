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
  isLoggingOut: boolean;
  isChangingSession: boolean;
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
  removeSavedAccount: (accountId: number) => void;
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
  isLoggingOut: false,
  isChangingSession: false,
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
    if (get().isLoggingOut || get().isChangingSession) return false;
    set({ isChangingSession: true });
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
    } finally {
      set({ isChangingSession: false });
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

      const cached = get().savedAccounts.find(a => a.id === userId);
      if (cached) {
        set({ currentUser: cached });
        getLocalDatabase(userId);
        void signalRService.initAsync(token);
        return true;
      }
      eventBus.emit('AuthFailedMessage', undefined);
      return false;
    } catch (ex) {
      console.warn('[AuthStore] Temporary session validation failure:', ex);
      const cached = get().savedAccounts.find(a => a.id === userId);
      if (cached) {
        set({ currentUser: cached });
        getLocalDatabase(userId);
        void signalRService.initAsync(token);
        return true;
      }
      return false;
    }
  },

  switchAccount: async (targetAccount, authService) => {
    if (get().isLoggingOut || get().isChangingSession) return;
    const current = get().currentUser;
    if (!targetAccount || targetAccount.id === current?.id) return;

    set({ switchAccountErrorMessage: '' });

    if (!targetAccount.token) {
      set({ switchAccountErrorMessage: 'Session expired. Please log in again.' });
      return;
    }

    set({ isChangingSession: true });
    const previousToken = userSession.token;
    const previousUserId = userSession.userId;
    const restoreSession = () => {
      userSession.setSession(previousUserId, previousToken);
      if (previousToken) localStorage.setItem('jwt_token', previousToken);
      else localStorage.removeItem('jwt_token');
    };
    try {
      userSession.setSession(targetAccount.id, targetAccount.token);

      const isValid = await authService.validateTokenAsync();
      if (!isValid) {
        restoreSession();
        set({ switchAccountErrorMessage: 'Session expired for this account.' });
        return;
      }

      await signalRService.stopAsync();
      localStorage.setItem('jwt_token', targetAccount.token);
      eventBus.emit('BeforeAccountSwitchMessage', undefined);
      closeLocalDatabase();

      set({ currentUser: targetAccount, isAddingNewAccount: false });
      getLocalDatabase(targetAccount.id);

      void signalRService.initAsync(targetAccount.token);
      eventBus.emit('UserProfileUpdatedMessage', { user: targetAccount });
      eventBus.emit('AccountSwitchedMessage', { nickName: targetAccount.nickName });
    } catch {
      restoreSession();
      set({ switchAccountErrorMessage: 'Error switching account.' });
    } finally {
      set({ isChangingSession: false });
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

    await signalRService.stopAsync();
    void signalRService.initAsync(token);
    eventBus.emit('UserProfileUpdatedMessage', { user });
    eventBus.emit('RegistrationSuccessMessage', undefined);
    eventBus.emit('AccountSwitchedMessage', {nickName:user.nickName});
  },

  removeSavedAccount: (accountId) => {
    const state = get();
    if (state.isLoggingOut || state.isChangingSession || state.currentUser?.id === accountId || userSession.userId === accountId) return;
    const remaining = state.savedAccounts.filter(account => account.id !== accountId);
    saveAccountsToStorage(remaining);
    set({ savedAccounts: remaining });
  },

  logOut: async (service) => {
    if (get().isLoggingOut || get().isChangingSession) return;
    set({ isLoggingOut: true });
    const accountId = userSession.userId || get().currentUser?.id;
    try {
      const { useCallsStore } = await import('./callsStore');
      const calls = useCallsStore.getState();
      if (calls.isIncomingCallVisible || calls.isOutgoingCallVisible || calls.isActiveCallVisible) await calls.endCall();
      const { webRtcCallService } = await import('../services/webRtcCallService');
      await webRtcCallService.cleanup();
      if (userSession.isAuthenticated) {
        const auth = service || (await import('../services/auth.service')).authService;
        await auth.logoutAsync();
      }
    } catch (error) {
      console.warn('[AuthStore] Logout cleanup failed:', error);
    } finally {
      try { await signalRService.stopAsync(); } catch {}
      eventBus.emit('BeforeAccountSwitchMessage', undefined);
      const { useChatStore } = await import('./chatStore');
      const { useMessageInputStore } = await import('./messageInputStore');
      const { useMusicPlayerStore } = await import('./musicPlayerStore');
      await useChatStore.getState().selectChatUser(null);
      useMessageInputStore.getState().reset();
      useMusicPlayerStore.getState().closePlayer();
      closeLocalDatabase();
      userSession.clear();
      localStorage.removeItem('jwt_token');
      localStorage.removeItem('auth_token');
      const remaining = get().savedAccounts.filter(account => account.id !== accountId);
      saveAccountsToStorage(remaining);
      set({ currentUser: null, savedAccounts: remaining, isLoggingOut: false,
        loginUser: { username: '', password: '' }, isAddingNewAccount: false,
        isVerificationStep: false, loginErrorMessage: '', switchAccountErrorMessage: '' });
      eventBus.emit('AuthFailedMessage', undefined);
    }
  },
}));

// Tabs share persisted credentials; close an old session when another tab logs out.
window.addEventListener('storage', (event) => {
  if (event.storageArea !== localStorage) return;
  if (event.key === 'saved_accounts') {
    useAuthStore.setState({ savedAccounts: loadAccountsFromStorage() });
  }
  if (event.key !== 'jwt_token' || event.newValue === userSession.token) return;
  if (event.newValue) {
    window.location.reload();
  } else if (userSession.isAuthenticated) {
    void useAuthStore.getState().logOut({ logoutAsync: async () => true });
  }
});
