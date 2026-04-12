import { useState, useEffect } from 'react';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

const RANK_ICONS = ['🥇', '🥈', '🥉'];
const AVATAR_COLORS = [
  { bg: 'rgba(244,185,64,0.12)', color: 'var(--amber)' },
  { bg: 'rgba(168,176,192,0.12)', color: '#A8B4C0' },
  { bg: 'rgba(205,143,90,0.12)', color: '#CD8F5A' },
  { bg: 'rgba(74,158,255,0.15)', color: 'var(--blue)' },
  { bg: 'rgba(240,90,90,0.1)', color: 'var(--red)' },
  { bg: 'rgba(139,111,255,0.1)', color: 'var(--purple)' },
  { bg: 'rgba(61,214,140,0.1)', color: 'var(--green)' },
];

interface LeaderboardEntry {
  user_id: string;
  username?: string;
  first_name?: string;
  points: number;
  strategy?: string;
}

interface OpponentPlayer {
  player_id: string;
  player_name: string;
  team: string;
  weightage: number;
  points_earned: number;
  player_role: string;
}

interface LeaderboardTabProps {
  roomId: string;
}

export function LeaderboardTab({ roomId }: LeaderboardTabProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewTeam, setViewTeam] = useState<{ userId: string; name: string; players: OpponentPlayer[]; totalPoints: number } | null>(null);
  const [teamLoading, setTeamLoading] = useState(false);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    async function fetchLeaderboard() {
      try {
        const { data } = await api.get(`/api/leaderboard/${roomId}`);
        setEntries(data);
      } catch { /* */ }
      finally { setLoading(false); }
    }
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 30000);
    return () => clearInterval(interval);
  }, [roomId]);

  async function handleViewTeam(entry: LeaderboardEntry) {
    setTeamLoading(true);
    try {
      const { data } = await api.get(`/api/game/${roomId}/team/${entry.user_id}`);
      setViewTeam({
        userId: entry.user_id,
        name: entry.username || entry.first_name || `Player ${entry.user_id.slice(0, 6)}`,
        players: data.player_weightages || [],
        totalPoints: data.total_points || 0,
      });
    } catch {
      // Teams hidden or error
    } finally { setTeamLoading(false); }
  }

  if (loading) return <div className="p-6 text-center" style={{ color: 'var(--muted)' }}>Loading leaderboard...</div>;

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
        <div className="text-2xl mb-3">🏆</div>
        <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 15, fontWeight: 800, marginBottom: 4 }}>No rankings yet</div>
        <div className="text-[12px]" style={{ color: 'var(--muted)' }}>Rankings appear once the match starts</div>
      </div>
    );
  }

  const topPoints = entries[0]?.points || 0;

  return (
    <div style={{ padding: '16px 20px' }}>
      <div className="flex items-center justify-between mb-4">
        <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 18, fontWeight: 900 }}>🏆 Leaderboard</div>
        <div className="text-[12px]" style={{ color: 'var(--muted)' }}>{entries.length} players</div>
      </div>

      <div className="space-y-1.5">
        {entries.map((entry, i) => {
          const isMe = user?.id === entry.user_id;
          const avStyle = AVATAR_COLORS[i % AVATAR_COLORS.length];
          const margin = topPoints > 0 && i > 0 ? topPoints - entry.points : 0;
          const displayName = entry.username || entry.first_name || `Player ${entry.user_id.slice(0, 6)}`;
          const initials = displayName.slice(0, 2).toUpperCase();

          return (
            <div
              key={entry.user_id}
              className="flex items-center gap-3 rounded-xl px-3 py-3"
              style={{
                background: isMe ? 'rgba(45,214,122,0.05)' : i === 0 && entry.points > 0 ? 'rgba(244,185,64,0.04)' : 'var(--surface)',
                border: isMe ? '1px solid rgba(45,214,122,0.25)' : i === 0 && entry.points > 0 ? '1px solid rgba(244,185,64,0.2)' : '1px solid var(--border)',
              }}
            >
              {/* Rank */}
              <div style={{ fontSize: 16, width: 24, textAlign: 'center', flexShrink: 0 }}>
                {i < 3 ? RANK_ICONS[i] : <span style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 14, fontWeight: 800, color: 'var(--muted)' }}>{i + 1}</span>}
              </div>

              {/* Avatar */}
              <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0, fontFamily: "'Cabinet Grotesk', sans-serif", background: avStyle.bg, color: avStyle.color }}>
                {initials}
              </div>

              {/* Name + strategy */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[14px] font-semibold">{isMe ? 'You' : displayName}</span>
                  {isMe && <span className="text-[9px] px-1.5 py-px rounded-full" style={{ background: 'rgba(45,214,122,0.12)', color: 'var(--green)', fontWeight: 700 }}>You</span>}
                  {i === 0 && entry.points > 0 && <span className="text-[9px] px-1.5 py-px rounded-full" style={{ background: 'rgba(244,185,64,0.12)', color: 'var(--amber)', fontWeight: 700 }}>Leader</span>}
                </div>
                <div className="text-[10px]" style={{ color: 'var(--muted)' }}>
                  {entry.strategy || (margin > 0 ? `${margin} pts behind` : '')}
                </div>
              </div>

              {/* Points */}
              <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 18, fontWeight: 900, color: i === 0 ? 'var(--amber)' : 'var(--text)', flexShrink: 0 }}>
                {entry.points.toLocaleString()}
              </div>

              {/* View team button */}
              {!isMe && (
                <button
                  onClick={() => handleViewTeam(entry)}
                  disabled={teamLoading}
                  style={{ fontSize: 10, fontWeight: 700, padding: '4px 8px', borderRadius: 6, background: 'var(--surface2)', color: 'var(--muted)', border: '1px solid var(--border)', cursor: 'pointer', flexShrink: 0 }}
                >
                  View XI
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Opponent team modal */}
      {viewTeam && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={() => setViewTeam(null)}
        >
          <div
            className="rounded-2xl w-full max-w-md mx-4 max-h-[70vh] flex flex-col"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 16, fontWeight: 800 }}>{viewTeam.name}'s Team</div>
                <div className="text-[11px]" style={{ color: 'var(--muted)' }}>{viewTeam.players.length} players · {viewTeam.totalPoints} pts</div>
              </div>
              <button onClick={() => setViewTeam(null)} className="text-lg bg-transparent border-none cursor-pointer" style={{ color: 'var(--muted)' }}>✕</button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-3">
              {viewTeam.players.map(p => (
                <div key={p.player_id} className="flex items-center gap-3 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold">{p.player_name}</div>
                    <div className="text-[10px]" style={{ color: 'var(--muted)' }}>{p.team} · {p.player_role}</div>
                  </div>
                  <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 15, fontWeight: 900, color: 'var(--amber)' }}>{p.weightage}x</div>
                  <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 15, fontWeight: 900, color: p.points_earned > 0 ? 'var(--green)' : 'var(--muted)', minWidth: 45, textAlign: 'right' }}>
                    {p.points_earned > 0 ? `+${p.points_earned}` : '0'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
