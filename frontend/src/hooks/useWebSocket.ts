import { useEffect, useRef } from 'react';
import { CrowdbashWebSocket } from '../lib/ws';
import { useRoomStore } from '../store/roomStore';
import { useGameStore } from '../store/gameStore';
import { useAuthStore } from '../store/authStore';
import type { WSMessage, ChatMessage, ScoreData, QuizQuestion, LeaderboardEntry, MatchEvent, Sport, PlayingXI } from '../types';

export function useWebSocket(roomId: string | undefined) {
  const wsRef = useRef<CrowdbashWebSocket | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playerEditCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const {
    setScore, setFanCount, addMessage, setActiveQuiz,
    setMatchProgress, setEditWindow, setPlayerEditWindow,
    addMatchEvent, setPlayingXi,
  } = useRoomStore();
  const { setLeaderboard, setEditWindow: setGameEditWindow } = useGameStore();

  useEffect(() => {
    if (!roomId) return;

    const ws = new CrowdbashWebSocket(roomId);
    wsRef.current = ws;

    ws.onMessage((msg: WSMessage) => {
      switch (msg.type) {
        case 'score_update': {
          const payload = msg.payload as { sport: Sport; data: Record<string, unknown> };
          if (payload.sport && payload.data) {
            setScore({ sport: payload.sport, ...payload.data } as ScoreData);
          } else {
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
            sport?: Sport;
            progress?: Record<string, unknown>;
            edit_window_open: boolean;
            closes_at?: number; // backend epoch seconds
            duration_seconds?: number;
          };
          if (p.progress) setMatchProgress(p.progress);
          // Cancel any prior close timer so a stale one can't shut a fresh window.
          if (closeTimerRef.current) {
            clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
          }
          if (p.edit_window_open) {
            setEditWindow(true);
            setGameEditWindow(true);
            // Prefer absolute close time from backend; fall back to duration.
            const nowSec = Date.now() / 1000;
            const remainingSec = p.closes_at
              ? Math.max(p.closes_at - nowSec, 0)
              : (p.duration_seconds ?? 300);
            closeTimerRef.current = setTimeout(() => {
              setEditWindow(false);
              setGameEditWindow(false);
              closeTimerRef.current = null;
            }, remainingSec * 1000);
          } else {
            setEditWindow(false);
            setGameEditWindow(false);
          }
          break;
        }
        case 'player_edit_window': {
          const p = msg.payload as {
            player_edit_window_open: boolean;
            closes_at?: number;
            duration_seconds?: number;
          };
          if (playerEditCloseTimerRef.current) {
            clearTimeout(playerEditCloseTimerRef.current);
            playerEditCloseTimerRef.current = null;
          }
          if (p.player_edit_window_open) {
            setPlayerEditWindow(true);
            const nowSec = Date.now() / 1000;
            const remainingSec = p.closes_at
              ? Math.max(p.closes_at - nowSec, 0)
              : (p.duration_seconds ?? 600);
            playerEditCloseTimerRef.current = setTimeout(() => {
              setPlayerEditWindow(false);
              playerEditCloseTimerRef.current = null;
            }, remainingSec * 1000);
          } else {
            setPlayerEditWindow(false);
          }
          break;
        }
        case 'match_event':
          addMatchEvent(msg.payload as MatchEvent);
          break;
        case 'playing_xi_announced': {
          const p = msg.payload as { playing_xi: PlayingXI; announced_at: string };
          if (p?.playing_xi) setPlayingXi(p.playing_xi, p.announced_at || null);
          break;
        }
      }
    });

    ws.connect();

    return () => {
      ws.disconnect();
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      if (playerEditCloseTimerRef.current) {
        clearTimeout(playerEditCloseTimerRef.current);
        playerEditCloseTimerRef.current = null;
      }
    };
  }, [roomId]);

  function sendChat(message: string) {
    // Include user identity in the chat message
    const user = useAuthStore.getState().user;
    wsRef.current?.send('chat', {
      message,
      user_id: user?.id || '',
      username: user ? `${user.first_name} ${user.last_name}`.trim() : 'Anonymous',
    });
  }

  return { sendChat };
}
