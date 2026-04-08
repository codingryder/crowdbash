import { useEffect, useRef } from 'react';
import { CrowdbashWebSocket } from '../lib/ws';
import { useRoomStore } from '../store/roomStore';
import { useGameStore } from '../store/gameStore';
import type { WSMessage, ChatMessage, ScoreData, QuizQuestion, LeaderboardEntry } from '../types';

export function useWebSocket(roomId: string | undefined) {
  const wsRef = useRef<CrowdbashWebSocket | null>(null);
  const { setScore, setFanCount, addMessage, setActiveQuiz, setCurrentOver, setEditWindow } =
    useRoomStore();
  const { setLeaderboard, setEditWindow: setGameEditWindow } = useGameStore();

  useEffect(() => {
    if (!roomId) return;

    const ws = new CrowdbashWebSocket(roomId);
    wsRef.current = ws;

    ws.onMessage((msg: WSMessage) => {
      switch (msg.type) {
        case 'score_update':
          setScore(msg.payload as ScoreData);
          break;
        case 'chat':
          addMessage(msg.payload as ChatMessage);
          break;
        case 'fan_count':
          setFanCount((msg.payload as { count: number }).count);
          break;
        case 'quiz_question':
          setActiveQuiz(msg.payload as QuizQuestion);
          break;
        case 'leaderboard_update':
          setLeaderboard(msg.payload as LeaderboardEntry[]);
          break;
        case 'over_complete': {
          const p = msg.payload as { over: number; edit_window_open: boolean };
          setCurrentOver(p.over);
          setEditWindow(p.edit_window_open);
          setGameEditWindow(p.edit_window_open);
          break;
        }
      }
    });

    ws.connect();

    return () => {
      ws.disconnect();
    };
  }, [roomId]);

  function sendChat(message: string) {
    wsRef.current?.send('chat', { message });
  }

  return { sendChat };
}
