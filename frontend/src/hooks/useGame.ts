import { useEffect } from 'react';
import axios from 'axios';
import api from '../lib/api';
import { useGameStore } from '../store/gameStore';

export function useGame(roomId: string | undefined) {
  const { game, setGame, setAvailableSquads } = useGameStore();

  useEffect(() => {
    if (!roomId) return;
    // Abort the previous room's fetches on navigation. Without this,
    // a slow response from the room you just left can land in the
    // store after you've moved on, rendering its XI in the new room.
    const ac = new AbortController();
    fetchGameState(ac.signal);
    fetchSquads(ac.signal);
    return () => ac.abort();
  }, [roomId]);

  async function fetchGameState(signal?: AbortSignal) {
    try {
      const { data } = await api.get(`/api/game/${roomId}`, { signal });
      setGame(data);
    } catch (err) {
      if (axios.isCancel(err)) return;
      // 404 / not joined yet — leave the store empty.
    }
  }

  async function fetchSquads(signal?: AbortSignal) {
    try {
      const { data } = await api.get(`/api/game/${roomId}/squads`, { signal });
      setAvailableSquads(data.teams || {});
    } catch (err) {
      if (axios.isCancel(err)) return;
      // No squads available yet.
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

  async function selectSquad(playerIds: string[], opts: { skipRefetch?: boolean } = {}) {
    if (!roomId) return;
    try {
      await api.post(`/api/game/${roomId}/select-squad`, { player_ids: playerIds });
      if (!opts.skipRefetch) await fetchGameState();
    } catch (err) {
      console.error('Failed to select squad', err);
      throw err;
    }
  }

  async function lockSquad(opts: { skipRefetch?: boolean } = {}) {
    if (!roomId) return;
    try {
      await api.post(`/api/game/${roomId}/lock-squad`);
      if (!opts.skipRefetch) await fetchGameState();
    } catch (err) {
      console.error('Failed to lock squad', err);
      throw err;
    }
  }

  async function saveWeightages(weightages: Array<{ player_id: string; weightage: number }>, opts: { skipRefetch?: boolean } = {}) {
    if (!roomId) return;
    try {
      await api.put(`/api/game/${roomId}/weightages`, { weightages });
      if (!opts.skipRefetch) await fetchGameState();
    } catch (err) {
      console.error('Failed to save weightages', err);
      throw err;
    }
  }

  return { game, joinGame, selectSquad, lockSquad, saveWeightages, fetchSquads, fetchGameState };
}
