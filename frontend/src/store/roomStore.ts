import { create } from 'zustand';
import type { ScoreData, ChatMessage, QuizQuestion, MatchEvent, Sport } from '../types';

interface RoomStore {
  sport: Sport;
  score: ScoreData | null;
  fanCount: number;
  messages: ChatMessage[];
  activeQuiz: QuizQuestion | null;
  currentOver: number;
  matchProgress: Record<string, unknown>;
  editWindowOpen: boolean;
  matchEvents: MatchEvent[];

  setSport: (sport: Sport) => void;
  setScore: (score: ScoreData) => void;
  setFanCount: (count: number) => void;
  addMessage: (msg: ChatMessage) => void;
  setActiveQuiz: (quiz: QuizQuestion | null) => void;
  setCurrentOver: (over: number) => void;
  setMatchProgress: (progress: Record<string, unknown>) => void;
  setEditWindow: (open: boolean) => void;
  addMatchEvent: (event: MatchEvent) => void;
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
  matchEvents: [],

  setSport: (sport) => set({ sport }),
  setScore: (score) => set({ score }),
  setFanCount: (count) => set({ fanCount: count }),
  addMessage: (msg) =>
    set((state) => ({
      messages: [...state.messages.slice(-200), msg],
    })),
  setActiveQuiz: (quiz) => set({ activeQuiz: quiz }),
  setCurrentOver: (over) => set({ currentOver: over }),
  setMatchProgress: (progress) => set({ matchProgress: progress }),
  setEditWindow: (open) => set({ editWindowOpen: open }),
  addMatchEvent: (event) =>
    set((state) => ({
      matchEvents: [event, ...state.matchEvents.slice(0, 99)],
    })),
}));
