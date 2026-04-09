import { useEffect } from 'react';
import api from '../lib/api';
import { useGameStore } from '../store/gameStore';

export function useGame(roomId: string | undefined) {
  const { game, setGame, setAvailableSquads } = useGameStore();

  useEffect(() => {
    if (!roomId) return;

    fetchGameState();
    fetchSquads();
  }, [roomId]);

  async function fetchGameState() {
    try {
      const { data } = await api.get(`/api/game/${roomId}`);
      setGame(data);
    } catch {
      // User hasn't joined this room yet
    }
  }

  async function fetchSquads() {
    try {
      const { data } = await api.get(`/api/game/${roomId}/squads`);
      setAvailableSquads(data.teams || {});
    } catch {
      // No squads available yet
    }
  }

  async function joinGame() {
    if (!roomId) return;
    try {
      await api.post(`/api/game/join/${roomId}`);
      await fetchGameState();
    } catch (err) {
      console.error('Failed to join game', err);
    }
  }

  async function selectSquad(playerIds: string[]) {
    if (!roomId) return;
    try {
      await api.post(`/api/game/${roomId}/select-squad`, { player_ids: playerIds });
      await fetchGameState();
    } catch (err) {
      console.error('Failed to select squad', err);
      throw err;
    }
  }

  async function lockSquad() {
    if (!roomId) return;
    try {
      await api.post(`/api/game/${roomId}/lock-squad`);
      await fetchGameState();
    } catch (err) {
      console.error('Failed to lock squad', err);
      throw err;
    }
  }

  async function saveWeightages(weightages: Array<{ player_id: string; weightage: number }>) {
    if (!roomId) return;
    try {
      await api.put(`/api/game/${roomId}/weightages`, { weightages });
      await fetchGameState();
    } catch (err) {
      console.error('Failed to save weightages', err);
      throw err;
    }
  }

  return { game, joinGame, selectSquad, lockSquad, saveWeightages, fetchSquads };
}
