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
  /** Modal mode controls which step the modal opens on and what UI is
   *  available:
   *    - 'full'     — normal pick → power → save flow.
   *    - 'powerOnly' — opens at power step, picker disabled. Reshuffle CTA.
   *    - 'xiOnly'   — opens at pick step, bench filtered to announced XI
   *                   only. "Review team" CTA after team-sheet drop. */
  teamBuilderMode: 'full' | 'powerOnly' | 'xiOnly';

  // Squad selection
  availableSquads: Record<string, SquadPlayer[]>;
  // True until the per-room /squads fetch resolves (success or empty),
  // so the UI can tell "still loading" apart from "fetched, no data".
  squadsLoading: boolean;
  selectedPlayerIds: string[];

  setGame: (game: Game) => void;
  setShowTeamBuilder: (show: boolean, mode?: 'full' | 'powerOnly' | 'xiOnly') => void;
  /** Bulk replace selectedPlayerIds — used by the xiOnly entrypoint to
   *  deselect any pre-picked players who aren't in the announced XI. */
  setSelectedPlayerIds: (ids: string[]) => void;
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
  teamBuilderMode: 'full',
  availableSquads: {},
  squadsLoading: true,
  selectedPlayerIds: [],

  setShowTeamBuilder: (show, mode) =>
    set({ showTeamBuilder: show, teamBuilderMode: mode || (show ? 'full' : 'full') }),

  setSelectedPlayerIds: (ids) => set({ selectedPlayerIds: ids }),

  setGame: (game) => {
    const used = game.player_weightages.reduce((sum, pw) => sum + pw.weightage, 0);
    const budget = (game.total_budget || TOTAL_BUDGET) - used;
    const selected = game.player_weightages.filter((pw) => pw.selected).map((pw) => pw.player_id);
    set({ game, remainingBudget: budget, selectedPlayerIds: selected });
  },

  setLeaderboard: (entries) => set({ leaderboard: entries }),
  setEditWindow: (open) => set({ editWindowOpen: open }),
  setAvailableSquads: (squads) => set({ availableSquads: squads, squadsLoading: false }),

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
    squadsLoading: true,
    selectedPlayerIds: [],
  }),

  getRemainingBudget: () => get().remainingBudget,
  canIncrease: () => get().remainingBudget > 0,
  canDecrease: (playerId) => {
    const pw = get().game?.player_weightages.find((p) => p.player_id === playerId);
    return (pw?.weightage ?? 0) > 0;
  },
}));
