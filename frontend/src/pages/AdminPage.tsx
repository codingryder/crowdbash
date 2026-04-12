import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAdminStore } from '../store/adminStore';
import api from '../lib/api';

interface AvailableMatch {
  match_id: string;
  match_name: string;
  sport: 'cricket' | 'football';
  league: string;
  match_format: string;
  venue: string;
  match_date: string;
  status: string;
  team1: { name: string; score: string };
  team2: { name: string; score: string };
  match_status_text: string;
}

export function AdminPage() {
  const { isLoggedIn, login, logout, rooms, loading, fetchRooms, createRoom, updateStatus, deleteRoom } = useAdminStore();
  const [tab, setTab] = useState<'rooms' | 'create'>('rooms');

  // Login form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Room filters
  const [filterSport, setFilterSport] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Create room — match selector
  const [availableMatches, setAvailableMatches] = useState<AvailableMatch[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<AvailableMatch | null>(null);
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState('');
  const [sportFilter, setSportFilter] = useState<'all' | 'cricket' | 'football'>('all');

  useEffect(() => {
    if (isLoggedIn) fetchRooms(filterSport || undefined, filterStatus || undefined);
  }, [isLoggedIn, filterSport, filterStatus, fetchRooms]);

  // Fetch available matches when Create Room tab is opened
  useEffect(() => {
    if (tab === 'create' && availableMatches.length === 0) {
      fetchAvailableMatches();
    }
  }, [tab]);

  const fetchAvailableMatches = async () => {
    setMatchesLoading(true);
    try {
      const { data } = await api.get('/api/matches/live');
      const all = [...(data.live || []), ...(data.upcoming || [])];
      setAvailableMatches(all);
    } catch {
      // ignore
    } finally {
      setMatchesLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');
    const ok = await login(username, password);
    if (!ok) setLoginError('Invalid credentials');
    setLoginLoading(false);
  };

  const handleCreateRoom = async () => {
    if (!selectedMatch) return;
    setCreating(true);
    setCreateMsg('');
    const result = await createRoom({
      sport: selectedMatch.sport,
      match_name: selectedMatch.match_name,
      match_format: selectedMatch.match_format,
      venue: selectedMatch.venue,
      league: selectedMatch.league,
      season: '2026',
      match_date: selectedMatch.match_date || undefined,
      match_id: selectedMatch.match_id || undefined,
    });
    if (result) {
      setCreateMsg(`Room created: ${result.match_name}`);
      setSelectedMatch(null);
      setTab('rooms');
    } else {
      setCreateMsg('Failed to create room');
    }
    setCreating(false);
  };

  const filteredAvailable = sportFilter === 'all'
    ? availableMatches
    : availableMatches.filter(m => m.sport === sportFilter);

  const liveAvailable = filteredAvailable.filter(m => m.status === 'live');
  const upcomingAvailable = filteredAvailable.filter(m => m.status === 'upcoming' || m.status === 'pre');

  // ─── NOT LOGGED IN ───
  if (!isLoggedIn) {
    return (
      <div style={{ paddingTop: 60, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <form onSubmit={handleLogin} style={{ width: '100%', maxWidth: 380, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '24px 20px' }} className="md:!p-9">
          <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 24, fontWeight: 900, marginBottom: 6 }}>Admin Panel</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 28 }}>Login to manage rooms and matches</div>
          {loginError && <div style={{ background: 'rgba(240,82,82,0.1)', border: '1px solid rgba(240,82,82,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--red)', marginBottom: 16 }}>{loginError}</div>}
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>Username</label>
          <input value={username} onChange={e => setUsername(e.target.value)} style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: 14, color: 'var(--text)', marginBottom: 16, outline: 'none', boxSizing: 'border-box' }} />
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: 14, color: 'var(--text)', marginBottom: 24, outline: 'none', boxSizing: 'border-box' }} />
          <button type="submit" disabled={loginLoading} className="btn btn-primary" style={{ width: '100%', padding: '12px 0', fontSize: 14, fontWeight: 700 }}>
            {loginLoading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    );
  }

  // ─── LOGGED IN ───
  return (
    <div style={{ paddingTop: 60, minHeight: '100vh' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 28, fontWeight: 900 }}>Admin Panel</div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Manage game rooms</div>
          </div>
          <button onClick={logout} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 18px', fontSize: 13, fontWeight: 600, color: 'var(--muted)', cursor: 'pointer' }}>
            Logout
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, background: 'var(--surface)', borderRadius: 'var(--radius-sm)', padding: 4, marginBottom: 24 }}>
          {(['rooms', 'create'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: '10px 0', fontSize: 13, fontWeight: 700, fontFamily: "'Cabinet Grotesk', sans-serif",
              background: tab === t ? 'var(--surface3)' : 'transparent',
              color: tab === t ? 'var(--text)' : 'var(--muted)',
              border: 'none', borderRadius: 7, cursor: 'pointer',
            }}>
              {t === 'rooms' ? 'All Rooms' : 'Create Room'}
            </button>
          ))}
        </div>

        {/* Success/error msg */}
        {createMsg && (
          <div style={{ background: createMsg.includes('Failed') ? 'rgba(240,82,82,0.1)' : 'rgba(45,214,122,0.1)', border: '1px solid ' + (createMsg.includes('Failed') ? 'rgba(240,82,82,0.3)' : 'rgba(45,214,122,0.3)'), borderRadius: 8, padding: '10px 14px', fontSize: 13, color: createMsg.includes('Failed') ? 'var(--red)' : 'var(--green)', marginBottom: 16 }}>
            {createMsg}
          </div>
        )}

        {/* ═══ TAB: ALL ROOMS ═══ */}
        {tab === 'rooms' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              {['', 'cricket', 'football'].map(s => (
                <button key={s} onClick={() => setFilterSport(s)} style={{
                  padding: '6px 16px', fontSize: 12, fontWeight: 600, borderRadius: 20,
                  background: filterSport === s ? 'var(--green)' : 'var(--surface2)',
                  color: filterSport === s ? '#071a0e' : 'var(--text2)',
                  border: '1px solid ' + (filterSport === s ? 'var(--green)' : 'var(--border)'), cursor: 'pointer',
                }}>
                  {s || 'All Sports'}
                </button>
              ))}
              <div style={{ width: 1, height: 28, background: 'var(--border)', margin: '0 4px' }} />
              {['', 'open', 'locked', 'closed'].map(s => (
                <button key={s} onClick={() => setFilterStatus(s)} style={{
                  padding: '6px 16px', fontSize: 12, fontWeight: 600, borderRadius: 20,
                  background: filterStatus === s ? 'var(--surface3)' : 'var(--surface2)',
                  color: filterStatus === s ? 'var(--text)' : 'var(--muted)',
                  border: '1px solid ' + (filterStatus === s ? 'var(--border2)' : 'var(--border)'), cursor: 'pointer',
                }}>
                  {s || 'All Status'}
                </button>
              ))}
            </div>

            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Loading rooms...</div>
            ) : rooms.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <div className="text-3xl mb-3">📋</div>
                <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 16, fontWeight: 800, marginBottom: 4 }}>No rooms created yet</div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>Go to the "Create Room" tab to create your first game room</div>
                <button onClick={() => setTab('create')} className="btn btn-primary" style={{ padding: '8px 20px', fontSize: 13 }}>
                  Create Room
                </button>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Match', 'Sport', 'League', 'Format', 'Date', 'Status', 'Fans', 'Actions'].map(h => (
                        <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '1px' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rooms.map(r => (
                      <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '12px', fontWeight: 600, maxWidth: 200 }}>
                          <Link to={`/room/${r.id}`} className="no-underline" style={{ color: 'var(--text)' }}>{r.match_name}</Link>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: r.sport === 'cricket' ? 'rgba(245,158,11,0.08)' : 'rgba(59,130,246,0.08)', color: r.sport === 'cricket' ? 'var(--amber)' : 'var(--blue)' }}>
                            {r.sport === 'cricket' ? '🏏' : '⚽'} {r.sport}
                          </span>
                        </td>
                        <td style={{ padding: '12px', color: 'var(--text2)' }}>{r.league || '—'}</td>
                        <td style={{ padding: '12px', color: 'var(--muted)' }}>{r.match_format || '—'}</td>
                        <td style={{ padding: '12px', color: 'var(--muted)', fontSize: 12 }}>{r.match_date ? new Date(r.match_date).toLocaleString() : '—'}</td>
                        <td style={{ padding: '12px' }}><StatusBadge status={r.status} /></td>
                        <td style={{ padding: '12px', color: 'var(--text2)' }}>{r.fan_count}</td>
                        <td style={{ padding: '12px' }}>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            <Link to={`/room/${r.id}`} style={{ padding: '4px 10px', fontSize: 11, fontWeight: 700, borderRadius: 6, background: 'rgba(59,130,246,0.1)', color: 'var(--blue)', border: '1px solid rgba(59,130,246,0.3)', cursor: 'pointer', textDecoration: 'none' }}>
                              View
                            </Link>
                            {r.status === 'open' && (
                              <button onClick={() => updateStatus(r.id, 'locked')} style={{ padding: '4px 10px', fontSize: 11, fontWeight: 700, borderRadius: 6, background: 'rgba(245,158,11,0.1)', color: 'var(--amber)', border: '1px solid rgba(245,158,11,0.3)', cursor: 'pointer' }}>
                                Lock
                              </button>
                            )}
                            {r.status === 'locked' && (
                              <button onClick={() => updateStatus(r.id, 'closed')} style={{ padding: '4px 10px', fontSize: 11, fontWeight: 700, borderRadius: 6, background: 'rgba(139,92,246,0.1)', color: 'var(--purple)', border: '1px solid rgba(139,92,246,0.3)', cursor: 'pointer' }}>
                                Close
                              </button>
                            )}
                            {r.status === 'closed' && (
                              <button onClick={() => updateStatus(r.id, 'open')} style={{ padding: '4px 10px', fontSize: 11, fontWeight: 700, borderRadius: 6, background: 'var(--surface2)', color: 'var(--muted)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                                Reopen
                              </button>
                            )}
                            <button onClick={() => { if (confirm(`Delete "${r.match_name}"?`)) deleteRoom(r.id); }} style={{ padding: '4px 10px', fontSize: 11, fontWeight: 700, borderRadius: 6, background: 'rgba(240,82,82,0.08)', color: 'var(--red)', border: '1px solid rgba(240,82,82,0.2)', cursor: 'pointer' }}>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ marginTop: 12, fontSize: 12, color: 'var(--muted)' }}>
                  {rooms.length} room{rooms.length !== 1 ? 's' : ''} total
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ TAB: CREATE ROOM ═══ */}
        {tab === 'create' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 18, fontWeight: 800 }}>
                Select a match to create a room
              </div>
              <button onClick={fetchAvailableMatches} disabled={matchesLoading} style={{ padding: '6px 16px', fontSize: 12, fontWeight: 600, borderRadius: 7, background: 'var(--surface2)', color: 'var(--text2)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                {matchesLoading ? 'Loading...' : 'Refresh'}
              </button>
            </div>

            {/* Sport filter */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
              {(['all', 'cricket', 'football'] as const).map(s => (
                <button key={s} onClick={() => setSportFilter(s)} style={{
                  padding: '6px 16px', fontSize: 12, fontWeight: 600, borderRadius: 20,
                  background: sportFilter === s ? 'var(--green)' : 'var(--surface2)',
                  color: sportFilter === s ? '#071a0e' : 'var(--text2)',
                  border: '1px solid ' + (sportFilter === s ? 'var(--green)' : 'var(--border)'), cursor: 'pointer',
                }}>
                  {s === 'all' ? 'All' : s === 'cricket' ? '🏏 Cricket' : '⚽ Football'}
                </button>
              ))}
            </div>

            {matchesLoading && (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Loading matches from APIs...</div>
            )}

            {!matchesLoading && filteredAvailable.length === 0 && (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
                No matches available right now. Try refreshing or check back during match hours.
              </div>
            )}

            {/* Live matches */}
            {!matchesLoading && liveAvailable.length > 0 && (
              <>
                <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '2px', color: 'var(--muted)', marginBottom: 10 }}>
                  <span style={{ color: '#ef4444' }}>●</span> LIVE MATCHES
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 10, marginBottom: 24 }}>
                  {liveAvailable.map(m => (
                    <MatchSelectCard
                      key={m.match_id}
                      match={m}
                      selected={selectedMatch?.match_id === m.match_id}
                      onSelect={() => setSelectedMatch(selectedMatch?.match_id === m.match_id ? null : m)}
                    />
                  ))}
                </div>
              </>
            )}

            {/* Upcoming matches */}
            {!matchesLoading && upcomingAvailable.length > 0 && (
              <>
                <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '2px', color: 'var(--muted)', marginBottom: 10 }}>UPCOMING MATCHES</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 10, marginBottom: 24 }}>
                  {upcomingAvailable.map(m => (
                    <MatchSelectCard
                      key={m.match_id}
                      match={m}
                      selected={selectedMatch?.match_id === m.match_id}
                      onSelect={() => setSelectedMatch(selectedMatch?.match_id === m.match_id ? null : m)}
                    />
                  ))}
                </div>
              </>
            )}

            {/* Confirm creation */}
            {selectedMatch && (
              <div style={{
                position: 'sticky', bottom: 0, left: 0, right: 0,
                background: 'var(--bg)', borderTop: '1px solid var(--border)',
                padding: '16px 0', marginTop: 8,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 15, fontWeight: 800 }}>
                      {selectedMatch.match_name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                      {selectedMatch.league} · {selectedMatch.match_format} · {selectedMatch.match_date ? new Date(selectedMatch.match_date).toLocaleString() : 'TBD'}
                    </div>
                  </div>
                  <button onClick={() => setSelectedMatch(null)} style={{ padding: '8px 16px', fontSize: 12, fontWeight: 600, borderRadius: 7, background: 'var(--surface2)', color: 'var(--muted)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button onClick={handleCreateRoom} disabled={creating} className="btn btn-primary" style={{ padding: '10px 28px', fontSize: 14, fontWeight: 700 }}>
                    {creating ? 'Creating...' : 'Create Room'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


/* ─── Match Select Card ─── */
function MatchSelectCard({ match, selected, onSelect }: { match: AvailableMatch; selected: boolean; onSelect: () => void }) {
  const t1 = match.team1?.name || 'TBD';
  const t2 = match.team2?.name || 'TBD';
  const isLive = match.status === 'live';
  const isCricket = match.sport === 'cricket';

  return (
    <div
      onClick={onSelect}
      className="cursor-pointer transition-all"
      style={{
        background: selected ? 'rgba(45,214,122,0.06)' : 'var(--surface)',
        border: selected ? '2px solid var(--green)' : '1px solid var(--border)',
        borderRadius: 12,
        padding: '14px 16px',
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {isLive ? (
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: 'rgba(240,82,82,0.1)', color: 'var(--red)', border: '1px solid rgba(240,82,82,0.3)' }}>● LIVE</span>
          ) : (
            <span style={{ fontSize: 10, color: 'var(--amber)', fontWeight: 600 }}>
              {match.match_date ? new Date(match.match_date).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'TBD'}
            </span>
          )}
        </div>
        <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4, color: isCricket ? 'var(--amber)' : 'var(--blue)', background: isCricket ? 'rgba(245,158,11,0.08)' : 'rgba(59,130,246,0.08)' }}>
          {isCricket ? '🏏' : '⚽'} {(match.match_format || '').slice(0, 14)}
        </span>
      </div>

      <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 15, fontWeight: 800, marginBottom: 2 }}>
        {t1} <span style={{ color: 'var(--faint)', fontWeight: 400, fontSize: 12 }}>vs</span> {t2}
      </div>

      <div style={{ fontSize: 11, color: 'var(--muted)' }}>
        {match.league || ''}
      </div>

      {isLive && match.team1?.score && (
        <div style={{ fontSize: 11, color: 'var(--green)', marginTop: 4, fontWeight: 600 }}>
          {match.team1.score} — {match.team2?.score || ''}
        </div>
      )}

      {selected && (
        <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: 'var(--green)' }}>
          ✓ Selected — click "Create Room" below
        </div>
      )}
    </div>
  );
}


/* ─── Helpers ─── */
function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; color: string; border: string }> = {
    open: { bg: 'rgba(45,214,122,0.1)', color: 'var(--green)', border: 'rgba(45,214,122,0.3)' },
    locked: { bg: 'rgba(245,158,11,0.1)', color: 'var(--amber)', border: 'rgba(245,158,11,0.3)' },
    closed: { bg: 'rgba(139,92,246,0.1)', color: 'var(--purple)', border: 'rgba(139,92,246,0.3)' },
  };
  const c = colors[status] || colors.open;
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 5, background: c.bg, color: c.color, border: `1px solid ${c.border}`, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
      {status === 'locked' && '🔒 '}{status}
    </span>
  );
}
