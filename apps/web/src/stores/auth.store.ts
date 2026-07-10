'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types/api.types';

interface AuthState {
  user: User | null;
  token: string | null;
  login: (user: User, token: string) => void;
  setToken: (token: string | null) => void;
  setUser: (user: User | null) => void;
  logout: () => void;
  clearOldStorage: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      login: (user, token) => set({ user, token }),
      setToken: (token) => set({ token }),
      setUser: (user) => set({ user }),
      logout: () => set({ user: null, token: null }),
      clearOldStorage: () => {
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem('viralforge-auth-v2');
          window.localStorage.removeItem('viralforge-auth');
          window.localStorage.removeItem('viralforge-auth-v1');
        }
      },
    }),
    {
      name: 'viralforge-auth-v3',
      partialize: (state) => ({ user: state.user, token: state.token }),
    },
  ),
);

// Clear old storage keys on first import in client-side (safe side effect)
if (typeof window !== 'undefined') {
  try {
    window.localStorage.removeItem('viralforge-auth-v2');
    window.localStorage.removeItem('viralforge-auth');
    window.localStorage.removeItem('viralforge-auth-v1');
  } catch {
    // localStorage might be unavailable (private browsing, quota exceeded)
  }
}

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return useAuthStore.getState().token;
}

export function clearAuth() {
  useAuthStore.getState().logout();
}

export function setAuthToken(token: string | null) {
  useAuthStore.getState().setToken(token);
}

export function setAuthUser(user: User | null) {
  useAuthStore.getState().setUser(user);
}
