import { useEffect, useState, useCallback } from 'react';
import api from '../lib/api';
import { useAuthStore } from '../store/authStore';

export interface Reward {
  id: string;
  sku: string;
  title: string;
  description: string | null;
  coin_cost: number;
  stock: number | null;
}

export interface Redemption {
  id: string;
  reward_id: string;
  coins_spent: number;
  status: string;
  code: string | null;
}

export function useCoinBalance() {
  const user = useAuthStore((s) => s.user);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setBalance(null);
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.get('/api/coins/balance');
      setBalance(data.lifetime_coins);
    } catch {
      setBalance(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { balance, loading, refresh };
}

export function useRewards() {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/api/coins/rewards');
      setRewards(data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to load rewards');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { rewards, loading, error, refresh };
}

export async function redeemReward(rewardId: string): Promise<Redemption> {
  const { data } = await api.post(`/api/coins/rewards/${rewardId}/redeem`);
  return data;
}
