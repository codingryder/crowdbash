import { useState, useEffect } from 'react';
import api from '../lib/api';
import type { Room } from '../types';

export function useRoom(roomId: string | undefined) {
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roomId) return;

    async function fetchRoom() {
      try {
        const { data } = await api.get(`/api/rooms/${roomId}`);
        setRoom(data);
      } catch (err) {
        console.error('Failed to fetch room', err);
      } finally {
        setLoading(false);
      }
    }

    fetchRoom();
  }, [roomId]);

  return { room, loading };
}
