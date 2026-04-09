import { useState, useEffect } from 'react';
import api from '../lib/api';
import type { Room } from '../types';

export function useRoom(roomId: string | undefined) {
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roomId) return;

    async function fetchRoom(retryCount = 0) {
      try {
        const { data } = await api.get(`/api/rooms/${roomId}`);
        setRoom(data);
      } catch {
        // Retry on cold start (server waking up)
        if (retryCount < 3) {
          await new Promise((r) => setTimeout(r, 3000));
          return fetchRoom(retryCount + 1);
        }
      } finally {
        setLoading(false);
      }
    }

    fetchRoom();
  }, [roomId]);

  return { room, loading };
}
