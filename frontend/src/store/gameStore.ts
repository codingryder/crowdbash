import { create } from 'zustand';
import type { Game, LeaderboardEntry } from '../types';

const TOTAL_BUDGET = 10;

interface GameStore {
  game: Game | null;
  leaderboard: LeaderboardEntry[];
  editWindowOpen: boolean;
  remainingBudget: number;

  setGame: (game: Game) => void;
  setLeaderboard: (entries: LeaderboardEntry[]) => void;
  setEditWindow: (open: boolean) => void;

  updateWeightage: (playerId: string, delta: number) => void;
  getRemainingBudget: () => number;
  canIncrease: (playerId: string) => boolean;
  canDecrease: (playerId: string) => boolean;
}

export const useGameStore = create<GameStore>((set, get) => ({
  game: null,
  leaderboard: [],
  editWindowOpen: false,
  remainingBudget: TOTAL_BUDGET,

  setGame: (game) => {
    const used = game.player_weightages.reduce((sum, pw) => sum + pw.weightage, 0);
    const extra = game.extra_weightage_used || 0;
    set({ game, remainingBudget: TOTAL_BUDGET + extra - used });
  },

  setLeaderboard: (entries) => set({ leaderboard: entries }),
  setEditWindow: (open) => set({ editWindowOpen: open }),

  updateWeightage: (playerId, delta) => {
    const { game } = get();
    if (!game) return;

    const pws = game.player_weightages.map((pw) => {
      if (pw.player_id !== playerId) return pw;
      const newWt = Math.max(0, pw.weightage + delta);
      return { ...pw, weightage: newWt };
    });

    const used = pws.reduce((sum, pw) => sum + pw.weightage, 0);
    const extra = game.extra_weightage_used || 0;
    const budget = TOTAL_BUDGET + extra - used;

    set({ game: { ...game, player_weightages: pws }, remainingBudget: budget });
  },

  getRemainingBudget: () => get().remainingBudget,

  canIncrease: (_playerId) => {
    return get().remainingBudget > 0;
  },

  canDecrease: (playerId) => {
    const pw = get().game?.player_weightages.find((p) => p.player_id === playerId);
    return (pw?.weightage ?? 0) > 0;
  },
}));
