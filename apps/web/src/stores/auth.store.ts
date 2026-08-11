import { create } from 'zustand';
import { UserRole } from '@app/shared';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: User) => void;
  clearUser: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  setUser: (user: User): void =>
    set({
      user,
      isAuthenticated: true,
    }),
  clearUser: (): void =>
    set({
      user: null,
      isAuthenticated: false,
    }),
}));
