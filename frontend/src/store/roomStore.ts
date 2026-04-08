import { create } from 'zustand';
import type { ScoreData, ChatMessage, QuizQuestion } from '../types';

interface RoomStore {
  score: ScoreData | null;
  fanCount: number;
  messages: ChatMessage[];
  activeQuiz: QuizQuestion | null;
  currentOver: number;
  editWindowOpen: boolean;

  setScore: (score: ScoreData) => void;
  setFanCount: (count: number) => void;
  addMessage: (msg: ChatMessage) => void;
  setActiveQuiz: (quiz: QuizQuestion | null) => void;
  setCurrentOver: (over: number) => void;
  setEditWindow: (open: boolean) => void;
}

export const useRoomStore = create<RoomStore>((set) => ({
  score: null,
  fanCount: 0,
  messages: [],
  activeQuiz: null,
  currentOver: 0,
  editWindowOpen: false,

  setScore: (score) => set({ score }),
  setFanCount: (count) => set({ fanCount: count }),
  addMessage: (msg) =>
    set((state) => ({
      messages: [...state.messages.slice(-200), msg],
    })),
  setActiveQuiz: (quiz) => set({ activeQuiz: quiz }),
  setCurrentOver: (over) => set({ currentOver: over }),
  setEditWindow: (open) => set({ editWindowOpen: open }),
}));
