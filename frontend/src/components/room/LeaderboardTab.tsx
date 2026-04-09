import { useState, useEffect } from 'react';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

const RANK_COLORS = ['var(--gold)', '#A8B4C0', '#CD8F5A'];
const AVATAR_COLORS = [
  { bg: 'rgba(244,185,64,0.12)', color: 'var(--gold)' },
  { bg: 'rgba(168,176,192,0.12)', color: '#A8B4C0' },
  { bg: 'rgba(205,143,90,0.12)', color: '#CD8F5A' },
  { bg: 'rgba(74,158,255,0.15)', color: 'var(--blue)' },
  { bg: 'rgba(240,90,90,0.1)', color: 'var(--red)' },
  { bg: 'rgba(139,111,255,0.1)', color: 'var(--purple)' },
  { bg: 'rgba(61,214,140,0.1)', color: 'var(--green)' },
];

interface LeaderboardEntry {
  user_id: string;
  points: number;
}

interface LeaderboardTabProps {
  roomId: string;
}

export function LeaderboardTab({ roomId }: LeaderboardTabProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    async function fetchLeaderboard() {
      try {
        const { data } = await api.get(`/api/leaderboard/${roomId}`);
        setEntries(data);
      } catch {
        // No leaderboard data
      } finally {
        setLoading(false);
      }
    }
    fetchLeaderboard();

    // Refresh every 30 seconds
    const interval = setInterval(fetchLeaderboard, 30000);
    return () => clearInterval(interval);
  }, [roomId]);

  if (loading) {
    return (
      <div className="p-6 text-center" style={{ color: 'var(--mu)' }}>Loading leaderboard...</div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
        <div className="text-2xl mb-3">🏆</div>
        <div className="text-[13px] font-medium mb-1" style={{ color: 'var(--tx)' }}>No rankings yet</div>
        <div className="text-[11px]" style={{ color: 'var(--mu)' }}>
          Rankings will appear once the match starts and players earn points
        </div>
      </div>
    );
  }

  const topPoints = entries[0]?.points || 0;

  return (
    <div style={{ padding: '16px 20px' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="font-syne text-[15px] font-bold" style={{ color: 'var(--tx)' }}>
          🏆 Fantasy Leaderboard
        </div>
        <div className="text-[11px]" style={{ color: 'var(--mu)' }}>
          {entries.length} players
        </div>
      </div>

      {/* Entries */}
      <div className="space-y-1.5">
        {entries.map((entry, i) => {
          const isMe = user?.id === entry.user_id;
          const avStyle = AVATAR_COLORS[i % AVATAR_COLORS.length];
          const rankColor = i < 3 ? RANK_COLORS[i] : 'var(--dm)';
          const margin = topPoints > 0 && i > 0 ? topPoints - entry.points : 0;
          const shortId = entry.user_id.slice(0, 6);

          return (
            <div
              key={entry.user_id}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5"
              style={{
                background: isMe ? 'rgba(244,185,64,0.06)' : 'var(--s1)',
                border: isMe ? '1px solid rgba(244,185,64,0.3)' : '0.5px solid var(--b1)',
              }}
            >
              {/* Rank */}
              <div
                className="font-syne text-[14px] font-extrabold w-6 text-center shrink-0"
                style={{ color: rankColor }}
              >
                {i + 1}
              </div>

              {/* Avatar */}
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                style={{ background: avStyle.bg, color: avStyle.color }}
              >
                {shortId.slice(0, 2).toUpperCase()}
              </div>

              {/* Name */}
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-medium" style={{ color: 'var(--tx)' }}>
                  {isMe ? 'You' : `Player ${shortId}`}
                  {isMe && (
                    <span className="text-[9px] ml-1 px-1.5 py-px rounded-full" style={{ background: 'rgba(244,185,64,0.15)', color: 'var(--gold)' }}>
                      You
                    </span>
                  )}
                </div>
                {margin > 0 && (
                  <div className="text-[10px]" style={{ color: 'var(--red)' }}>
                    -{margin} pts behind
                  </div>
                )}
                {i === 0 && entry.points > 0 && (
                  <div className="text-[10px]" style={{ color: 'var(--green)' }}>
                    Leading!
                  </div>
                )}
              </div>

              {/* Points */}
              <div className="font-syne text-[15px] font-bold shrink-0" style={{ color: 'var(--gold)' }}>
                {entry.points.toLocaleString()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
