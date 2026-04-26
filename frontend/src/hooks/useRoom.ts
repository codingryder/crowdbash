import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import type { Room } from '../types';

export function useRoom(roomId: string | undefined) {
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRoom = useCallback(async (retryCount = 0): Promise<void> => {
    if (!roomId) return;
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
  }, [roomId]);

  useEffect(() => {
    fetchRoom();
  }, [fetchRoom]);

  // Poll every 30s + refetch on visibility/focus so a status change
  // (e.g. backend flipping the room to "locked" when the match starts)
  // propagates automatically. The parent page conditionally renders
  // the team builder based on room.status, so this naturally bounces
  // the user out of Edit XI / player selection into the live room.
  useEffect(() => {
    if (!roomId) return;
    const interval = setInterval(() => fetchRoom(), 30000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchRoom();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [roomId, fetchRoom]);

  return { room, loading };
}
