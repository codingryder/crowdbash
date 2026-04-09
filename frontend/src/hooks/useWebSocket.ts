import { useEffect, useRef } from 'react';
import { CrowdbashWebSocket } from '../lib/ws';
import { useRoomStore } from '../store/roomStore';
import { useGameStore } from '../store/gameStore';
import type { WSMessage, ChatMessage, ScoreData, QuizQuestion, LeaderboardEntry, MatchEvent, Sport } from '../types';

export function useWebSocket(roomId: string | undefined) {
  const wsRef = useRef<CrowdbashWebSocket | null>(null);
  const {
    setScore, setFanCount, addMessage, setActiveQuiz,
    setMatchProgress, setEditWindow, addMatchEvent,
  } = useRoomStore();
  const { setLeaderboard, setEditWindow: setGameEditWindow } = useGameStore();

  useEffect(() => {
    if (!roomId) return;

    const ws = new CrowdbashWebSocket(roomId);
    wsRef.current = ws;

    ws.onMessage((msg: WSMessage) => {
      switch (msg.type) {
        case 'score_update': {
          // New format: { sport, data } wrapper
          const payload = msg.payload as { sport: Sport; data: Record<string, unknown> };
          if (payload.sport && payload.data) {
            setScore({ sport: payload.sport, ...payload.data } as ScoreData);
          } else {
            // Backward compat: direct score data
            setScore(msg.payload as ScoreData);
          }
          break;
        }
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
        case 'edit_window': {
          const p = msg.payload as {
            sport: Sport;
            progress: Record<string, unknown>;
            edit_window_open: boolean;
          };
          setMatchProgress(p.progress);
          setEditWindow(p.edit_window_open);
          setGameEditWindow(p.edit_window_open);
          break;
        }
        case 'match_event':
          addMatchEvent(msg.payload as MatchEvent);
          break;
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
