import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import api from '../lib/api';
import { useAuthStore } from '../store/authStore';

type PastGame = {
  room_id: string;
  match_name: string;
  league: string | null;
  sport: string;
  completed_at: string | null;
  your_rank: number | null;
  your_points: number;
  total_players: number;
  you_won: boolean;
};

type LeaderboardEntry = {
  user_id: string;
  username: string;
  first_name: string;
  points: number;
  strategy: string;
  team_built: boolean;
};

function rankSuffix(n: number): string {
  const j = n % 10, k = n % 100;
  if (k >= 11 && k <= 13) return `${n}th`;
  if (j === 1) return `${n}st`;
  if (j === 2) return `${n}nd`;
  if (j === 3) return `${n}rd`;
  return `${n}th`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return ''; }
}

function PastGamesSection({ currentUserId }: { currentUserId: string }) {
  const [games, setGames] = useState<PastGame[] | null>(null);
  const [error, setError] = useState('');
  const [expandedRoom, setExpandedRoom] = useState<string | null>(null);
  const [boardCache, setBoardCache] = useState<Record<string, LeaderboardEntry[] | 'loading' | 'error'>>({});

  useEffect(() => {
    api.get('/api/auth/me/past-games')
      .then(({ data }) => setGames(data))
      .catch(() => setError('Could not load past games'));
  }, []);

  async function toggleExpand(roomId: string) {
    if (expandedRoom === roomId) { setExpandedRoom(null); return; }
    setExpandedRoom(roomId);
    if (boardCache[roomId]) return;
    setBoardCache(prev => ({ ...prev, [roomId]: 'loading' }));
    try {
      const { data } = await api.get(`/api/leaderboard/${roomId}`);
      setBoardCache(prev => ({ ...prev, [roomId]: data }));
    } catch {
      setBoardCache(prev => ({ ...prev, [roomId]: 'error' }));
    }
  }

  if (error) {
    return <div className="text-[12px]" style={{ color: 'var(--muted)' }}>{error}</div>;
  }
  if (games === null) {
    return <div className="text-[12px]" style={{ color: 'var(--muted)' }}>Loading past games...</div>;
  }
  if (games.length === 0) {
    return <div className="text-[12px]" style={{ color: 'var(--muted)' }}>You haven't finished any games yet.</div>;
  }

  return (
    <div className="space-y-2">
      {games.map(g => {
        const expanded = expandedRoom === g.room_id;
        const board = boardCache[g.room_id];
        return (
          <div key={g.room_id} className="rounded-lg" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
            <button
              onClick={() => toggleExpand(g.room_id)}
              className="w-full text-left px-3 py-2.5 flex items-center justify-between gap-2 cursor-pointer"
              style={{ background: 'transparent', border: 'none', color: 'var(--text)' }}
            >
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold truncate flex items-center gap-2">
                  {g.you_won && <span aria-label="winner" title="You won this game" style={{ color: 'var(--gold)' }}>🏆</span>}
                  {g.match_name}
                </div>
                <div className="text-[11px]" style={{ color: 'var(--muted)' }}>
                  {[g.league, formatDate(g.completed_at)].filter(Boolean).join(' • ')}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[13px] font-bold" style={{ color: g.you_won ? 'var(--gold)' : 'var(--text)' }}>
                  {g.your_rank ? `${rankSuffix(g.your_rank)} / ${g.total_players}` : '—'}
                </div>
                <div className="text-[11px]" style={{ color: 'var(--muted)' }}>{g.your_points} pts</div>
              </div>
            </button>
            {expanded && (
              <div style={{ borderTop: '1px solid var(--border)', padding: '8px 12px' }}>
                {board === 'loading' && <div className="text-[12px] py-2" style={{ color: 'var(--muted)' }}>Loading leaderboard...</div>}
                {board === 'error' && <div className="text-[12px] py-2" style={{ color: 'var(--red)' }}>Couldn't load leaderboard.</div>}
                {Array.isArray(board) && board.length === 0 && <div className="text-[12px] py-2" style={{ color: 'var(--muted)' }}>No players to show.</div>}
                {Array.isArray(board) && board.length > 0 && (
                  <div className="space-y-1">
                    {board.map((row, idx) => {
                      const isYou = row.user_id === currentUserId;
                      const rank = idx + 1;
                      const rankColor = rank === 1 ? 'var(--gold)' : rank === 2 ? '#A8B4C0' : rank === 3 ? '#CD8F5A' : 'var(--muted)';
                      return (
                        <div
                          key={row.user_id}
                          className="flex items-center justify-between text-[12px] px-2 py-1.5 rounded"
                          style={{ background: isYou ? 'rgba(45,214,122,0.08)' : 'transparent' }}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span style={{ color: rankColor, fontWeight: 700, minWidth: 18 }}>{rank}</span>
                            <span className={isYou ? 'font-semibold' : ''} style={{ color: isYou ? 'var(--green)' : 'var(--text)' }}>
                              {isYou ? 'You' : (row.first_name || row.username)}
                            </span>
                          </div>
                          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{row.points} pts</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ProfilePage() {
  const { user, isLoading, logout } = useAuth();
  const setUser = useAuthStore(s => s.setUser);
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  if (isLoading) return <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 52px)', paddingTop: 60 }}><div style={{ color: 'var(--muted)' }}>Loading...</div></div>;
  if (!user) return <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 52px)', paddingTop: 60 }}><div style={{ color: 'var(--muted)' }}>Please sign in to view your profile.</div></div>;

  function startEdit() {
    setFirstName(user!.first_name || '');
    setLastName(user!.last_name || '');
    setUsername(user!.username || '');
    setEditing(true);
    setMsg('');
  }

  async function saveProfile() {
    setSaving(true);
    setMsg('');
    try {
      const { data } = await api.put('/api/auth/me', { first_name: firstName, last_name: lastName, username });
      setUser({ ...user!, first_name: data.first_name, last_name: data.last_name, username: data.username });
      setEditing(false);
      setMsg('Profile updated!');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setMsg(err.response?.data?.detail || 'Failed to update');
    } finally { setSaving(false); }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)',
    borderRadius: 9, padding: '10px 14px', fontSize: 14, color: 'var(--text)',
    outline: 'none', boxSizing: 'border-box',
  };

  return (
    <main style={{ paddingTop: 60, maxWidth: 500, margin: '0 auto', padding: '80px 16px 40px' }} className="md:!px-8">
      <div className="rounded-2xl p-5 md:p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        {/* Avatar + Name */}
        <div className="flex items-center gap-4 mb-6">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold shrink-0"
            style={{ fontFamily: "'Cabinet Grotesk', sans-serif", background: 'rgba(45,214,122,0.12)', color: 'var(--green)' }}
          >
            {(user.first_name?.[0] || '').toUpperCase()}{(user.last_name?.[0] || '').toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 20, fontWeight: 900, overflowWrap: 'anywhere' }}>
              {user.first_name} {user.last_name}
            </div>
            <div className="text-[12px]" style={{ color: 'var(--muted)', overflowWrap: 'anywhere' }}>@{user.username}</div>
            <div className="text-[12px]" style={{ color: 'var(--muted)', overflowWrap: 'anywhere' }}>{user.email}</div>
          </div>
        </div>

        {msg && (
          <div style={{ background: msg.includes('Failed') || msg.includes('taken') ? 'rgba(240,82,82,0.1)' : 'rgba(45,214,122,0.1)', border: `1px solid ${msg.includes('Failed') || msg.includes('taken') ? 'rgba(240,82,82,0.3)' : 'rgba(45,214,122,0.3)'}`, borderRadius: 8, padding: '8px 14px', fontSize: 13, color: msg.includes('Failed') || msg.includes('taken') ? 'var(--red)' : 'var(--green)', marginBottom: 16 }}>
            {msg}
          </div>
        )}

        {editing ? (
          /* ── EDIT MODE ── */
          <div className="space-y-4 mb-6">
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 6, fontFamily: "'Cabinet Grotesk', sans-serif", letterSpacing: 1 }}>FIRST NAME</label>
              <input value={firstName} onChange={e => setFirstName(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 6, fontFamily: "'Cabinet Grotesk', sans-serif", letterSpacing: 1 }}>LAST NAME</label>
              <input value={lastName} onChange={e => setLastName(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 6, fontFamily: "'Cabinet Grotesk', sans-serif", letterSpacing: 1 }}>USERNAME</label>
              <input value={username} onChange={e => setUsername(e.target.value)} style={inputStyle} />
            </div>
            <div className="flex gap-3">
              <button onClick={saveProfile} disabled={saving} className="btn btn-primary" style={{ flex: 1, padding: '10px', fontSize: 14, fontWeight: 700 }}>
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => setEditing(false)} style={{ flex: 1, padding: '10px', fontSize: 14, fontWeight: 600, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 9, color: 'var(--muted)', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          /* ── VIEW MODE ── */
          <>
            <div className="space-y-3 mb-6">
              {[
                { label: 'First Name', value: user.first_name || '—' },
                { label: 'Last Name', value: user.last_name || '—' },
                { label: 'Username', value: `@${user.username}` },
                { label: 'Email', value: user.email },
                { label: 'Phone', value: user.phone || 'Not provided' },
              ].map((item) => (
                <div key={item.label} className="flex justify-between items-baseline gap-3 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
                  <span className="text-[12px] shrink-0" style={{ color: 'var(--muted)' }}>{item.label}</span>
                  <span className="text-[13px] font-medium text-right min-w-0" style={{ overflowWrap: 'anywhere' }}>{item.value}</span>
                </div>
              ))}
            </div>

            <button onClick={startEdit} className="w-full py-2.5 rounded-lg text-[13px] font-semibold cursor-pointer mb-3" style={{ background: 'rgba(45,214,122,0.08)', color: 'var(--green)', border: '1px solid rgba(45,214,122,0.2)' }}>
              Edit Profile
            </button>
          </>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="rounded-lg p-3 text-center" style={{ background: 'var(--surface2)' }}>
            <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 20, fontWeight: 900, color: 'var(--amber)' }}>{user.total_games}</div>
            <div className="text-[10px]" style={{ color: 'var(--muted)' }}>Games</div>
          </div>
          <div className="rounded-lg p-3 text-center" style={{ background: 'var(--surface2)' }}>
            <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 20, fontWeight: 900, color: 'var(--green)' }}>{user.total_wins}</div>
            <div className="text-[10px]" style={{ color: 'var(--muted)' }}>Wins</div>
          </div>
          <div className="rounded-lg p-3 text-center" style={{ background: 'var(--surface2)' }}>
            <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 20, fontWeight: 900, color: 'var(--purple)' }}>{user.weightage_balance}</div>
            <div className="text-[10px]" style={{ color: 'var(--muted)' }}>Extra WP</div>
          </div>
        </div>

        <button onClick={logout} className="w-full py-2.5 rounded-lg text-[13px] font-semibold cursor-pointer border-none" style={{ background: 'rgba(240,90,90,0.08)', color: 'var(--red)', border: '1px solid rgba(240,90,90,0.15)' }}>
          Sign Out
        </button>
      </div>

      <div className="rounded-2xl p-5 md:p-6 mt-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="text-[11px] font-bold mb-3" style={{ color: 'var(--muted)', fontFamily: "'Cabinet Grotesk', sans-serif", letterSpacing: 1 }}>
          PAST GAMES
        </div>
        <PastGamesSection currentUserId={user.id} />
      </div>
    </main>
  );
}
