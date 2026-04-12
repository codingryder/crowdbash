import { create } from 'zustand';
import type { Game, LeaderboardEntry, SquadPlayer } from '../types';

const TOTAL_BUDGET = 33;
const MAX_SQUAD = 11;

interface GameStore {
  game: Game | null;
  leaderboard: LeaderboardEntry[];
  editWindowOpen: boolean;
  remainingBudget: number;
  showTeamBuilder: boolean;

  // Squad selection
  availableSquads: Record<string, SquadPlayer[]>;
  selectedPlayerIds: string[];

  setGame: (game: Game) => void;
  setShowTeamBuilder: (show: boolean) => void;
  setLeaderboard: (entries: LeaderboardEntry[]) => void;
  setEditWindow: (open: boolean) => void;
  setAvailableSquads: (squads: Record<string, SquadPlayer[]>) => void;

  // Squad selection actions
  togglePlayer: (playerId: string) => void;
  isPlayerSelected: (playerId: string) => boolean;
  canSelectMore: () => boolean;
  getSelectedCount: () => number;

  // Weightage actions
  updateWeightage: (playerId: string, delta: number) => void;
  getRemainingBudget: () => number;
  canIncrease: (playerId: string) => boolean;
  canDecrease: (playerId: string) => boolean;

  // Reset
  reset: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  game: null,
  leaderboard: [],
  editWindowOpen: false,
  remainingBudget: TOTAL_BUDGET,
  showTeamBuilder: false,
  availableSquads: {},
  selectedPlayerIds: [],

  setShowTeamBuilder: (show) => set({ showTeamBuilder: show }),

  setGame: (game) => {
    const used = game.player_weightages.reduce((sum, pw) => sum + pw.weightage, 0);
    const budget = (game.total_budget || TOTAL_BUDGET) - used;
    const selected = game.player_weightages.filter((pw) => pw.selected).map((pw) => pw.player_id);
    set({ game, remainingBudget: budget, selectedPlayerIds: selected });
  },

  setLeaderboard: (entries) => set({ leaderboard: entries }),
  setEditWindow: (open) => set({ editWindowOpen: open }),
  setAvailableSquads: (squads) => set({ availableSquads: squads }),

  // Squad selection
  togglePlayer: (playerId) => {
    const { selectedPlayerIds } = get();
    if (selectedPlayerIds.includes(playerId)) {
      set({ selectedPlayerIds: selectedPlayerIds.filter((id) => id !== playerId) });
    } else if (selectedPlayerIds.length < MAX_SQUAD) {
      set({ selectedPlayerIds: [...selectedPlayerIds, playerId] });
    }
  },

  isPlayerSelected: (playerId) => get().selectedPlayerIds.includes(playerId),
  canSelectMore: () => get().selectedPlayerIds.length < MAX_SQUAD,
  getSelectedCount: () => get().selectedPlayerIds.length,

  // Weightage
  updateWeightage: (playerId, delta) => {
    const { game } = get();
    if (!game) return;

    const pws = game.player_weightages.map((pw) => {
      if (pw.player_id !== playerId) return pw;
      const newWt = Math.max(0, pw.weightage + delta);
      return { ...pw, weightage: newWt };
    });

    const used = pws.reduce((sum, pw) => sum + pw.weightage, 0);
    const budget = (game.total_budget || TOTAL_BUDGET) - used;

    set({ game: { ...game, player_weightages: pws }, remainingBudget: budget });
  },

  reset: () => set({
    game: null,
    leaderboard: [],
    editWindowOpen: false,
    remainingBudget: TOTAL_BUDGET,
    showTeamBuilder: false,
    availableSquads: {},
    selectedPlayerIds: [],
  }),

  getRemainingBudget: () => get().remainingBudget,
  canIncrease: () => get().remainingBudget > 0,
  canDecrease: (playerId) => {
    const pw = get().game?.player_weightages.find((p) => p.player_id === playerId);
    return (pw?.weightage ?? 0) > 0;
  },
}));
