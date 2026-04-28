import { create } from 'zustand';
import { useGameStore } from './gameStore';

interface AuthUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  username: string;
  payment_status: string;
  avatar_url?: string;
  total_games: number;
  total_wins: number;
  weightage_balance: number;
  terms_accepted_at?: string | null;
}

interface AuthStore {
  user: AuthUser | null;
  isLoading: boolean;
  showAuthModal: boolean;

  setUser: (user: AuthUser | null) => void;
  setLoading: (loading: boolean) => void;
  setShowAuthModal: (show: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isLoading: true,
  showAuthModal: false,

  setUser: (user) => set({ user, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
  setShowAuthModal: (showAuthModal) => set({ showAuthModal }),
  logout: () => {
    localStorage.removeItem('crowdbash_token');
    set({ user: null, isLoading: false });
    useGameStore.getState().reset();
  },
}));
