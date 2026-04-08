import { useEffect } from 'react';
import api from '../lib/api';
import { useGameStore } from '../store/gameStore';

export function useGame(roomId: string | undefined) {
  const { game, setGame } = useGameStore();

  useEffect(() => {
    if (!roomId) return;

    async function fetchGame() {
      try {
        const { data } = await api.get(`/api/game/${roomId}`);
        setGame(data);
      } catch {
        // User hasn't joined this room yet
      }
    }

    fetchGame();
  }, [roomId]);

  async function joinGame() {
    if (!roomId) return;
    try {
      await api.post(`/api/game/join/${roomId}`);
      const { data } = await api.get(`/api/game/${roomId}`);
      setGame(data);
    } catch (err) {
      console.error('Failed to join game', err);
    }
  }

  return { game, joinGame };
}
