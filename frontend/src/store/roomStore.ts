import { create } from 'zustand';
import type { ScoreData, ChatMessage, QuizQuestion, MatchEvent, Sport, PlayingXI } from '../types';

interface RoomStore {
  sport: Sport;
  score: ScoreData | null;
  fanCount: number;
  messages: ChatMessage[];
  activeQuiz: QuizQuestion | null;
  currentOver: number;
  matchProgress: Record<string, unknown>;
  editWindowOpen: boolean;
  /** Admin player-edit window — distinct from editWindowOpen (reshuffle). */
  playerEditWindowOpen: boolean;
  matchEvents: MatchEvent[];
  playingXi: PlayingXI | null;
  playingXiAnnouncedAt: string | null;
  // Per-session dismiss for the announcement banner. Cleared on full reload.
  playingXiBannerDismissed: boolean;

  setSport: (sport: Sport) => void;
  setScore: (score: ScoreData) => void;
  setFanCount: (count: number) => void;
  addMessage: (msg: ChatMessage) => void;
  setMessages: (msgs: ChatMessage[]) => void;
  setActiveQuiz: (quiz: QuizQuestion | null) => void;
  setCurrentOver: (over: number) => void;
  setMatchProgress: (progress: Record<string, unknown>) => void;
  setEditWindow: (open: boolean) => void;
  setPlayerEditWindow: (open: boolean) => void;
  addMatchEvent: (event: MatchEvent) => void;
  setPlayingXi: (xi: PlayingXI | null, announcedAt: string | null) => void;
  dismissPlayingXiBanner: () => void;
}

export const useRoomStore = create<RoomStore>((set) => ({
  sport: 'cricket',
  score: null,
  fanCount: 0,
  messages: [],
  activeQuiz: null,
  currentOver: 0,
  matchProgress: {},
  editWindowOpen: false,
  playerEditWindowOpen: false,
  matchEvents: [],
  playingXi: null,
  playingXiAnnouncedAt: null,
  playingXiBannerDismissed: false,

  setSport: (sport) => set({ sport }),
  setScore: (score) => set({ score }),
  setFanCount: (count) => set({ fanCount: count }),
  addMessage: (msg) =>
    set((state) => {
      if (state.messages.some((m) => m.id === msg.id)) return state;
      return { messages: [...state.messages.slice(-200), msg] };
    }),
  setMessages: (msgs) => set({ messages: msgs.slice(-200) }),
  setActiveQuiz: (quiz) => set({ activeQuiz: quiz }),
  setCurrentOver: (over) => set({ currentOver: over }),
  setMatchProgress: (progress) => set({ matchProgress: progress }),
  setEditWindow: (open) => set({ editWindowOpen: open }),
  setPlayerEditWindow: (open) => set({ playerEditWindowOpen: open }),
  addMatchEvent: (event) =>
    set((state) => ({
      matchEvents: [event, ...state.matchEvents.slice(0, 99)],
    })),
  setPlayingXi: (xi, announcedAt) =>
    set((state) => {
      // Reset the dismissed flag whenever we transition from "no XI" to
      // "XI announced" — a fresh announcement deserves a fresh banner.
      const isNew = !!xi && !state.playingXi;
      return {
        playingXi: xi,
        playingXiAnnouncedAt: announcedAt,
        playingXiBannerDismissed: isNew ? false : state.playingXiBannerDismissed,
      };
    }),
  dismissPlayingXiBanner: () => set({ playingXiBannerDismissed: true }),
}));
