import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import type { Room } from '../types';
import { useRoomStore } from '../store/roomStore';

export function useRoom(roomId: string | undefined) {
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const setPlayingXi = useRoomStore((s) => s.setPlayingXi);

  const fetchRoom = useCallback(async (retryCount = 0): Promise<void> => {
    if (!roomId) return;
    try {
      const { data } = await api.get(`/api/rooms/${roomId}`);
      setRoom(data);
      // Hydrate playing-XI store from persisted room state so reload/late
      // arrivals see the banner without waiting for the WS push.
      if (data?.playing_xi) {
        setPlayingXi(data.playing_xi, data.playing_xi_announced_at || null);
      }
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
