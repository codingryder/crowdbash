import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAdminStore, type AdminRoom } from '../store/adminStore';
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
  const {
    isLoggedIn, login, logout, rooms, loading,
    fetchRooms, createRoom, updateStatus, deleteRoom,
    openEditWindow, closeEditWindow,
    openPlayerEditWindow, closePlayerEditWindow,
    refreshSquads, setLateJoin,
    announceXi, clearXi,
    broadcastRecipients, broadcastRoomInvite,
  } = useAdminStore();
  const [tab, setTab] = useState<'rooms' | 'create' | 'custom'>('rooms');

  // Custom-room form state — used by the "Custom" tab to spin up a test
  // room with an arbitrary match_id (e.g. "espn_740922" for a real ESPN
  // fixture so the football squad sync pulls real rosters).
  const [customSport, setCustomSport] = useState<'cricket' | 'football'>('football');
  const [customMatchName, setCustomMatchName] = useState('Chelsea vs Manchester United');
  const [customLeague, setCustomLeague] = useState('Premier League');
  const [customFormat, setCustomFormat] = useState('Premier League');
  const [customVenue, setCustomVenue] = useState('Stamford Bridge');
  const [customSeason, setCustomSeason] = useState('2025-26');
  const [customMatchId, setCustomMatchId] = useState('espn_740922');
  const [customMatchDate, setCustomMatchDate] = useState(() => {
    // Default to ~5 days from now so the room stays "open" while testing.
    const d = new Date();
    d.setDate(d.getDate() + 5);
    d.setHours(19, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [customSubmitting, setCustomSubmitting] = useState(false);
  const [reshuffleDurations, setReshuffleDurations] = useState<Record<string, number>>({});
  const [reshuffleBusy, setReshuffleBusy] = useState<Record<string, boolean>>({});
  const [playerEditDurations, setPlayerEditDurations] = useState<Record<string, number>>({});
  const [playerEditBusy, setPlayerEditBusy] = useState<Record<string, boolean>>({});
  const [xiBusy, setXiBusy] = useState<Record<string, boolean>>({});
  const [syncBusy, setSyncBusy] = useState<Record<string, boolean>>({});
  const [syncMsg, setSyncMsg] = useState('');
  const [broadcastRoom, setBroadcastRoom] = useState<AdminRoom | null>(null);

  // Tick every 5s so the "Active Xs left" badge counts down without manual refresh.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

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
          {(['rooms', 'create', 'custom'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: '10px 0', fontSize: 13, fontWeight: 700, fontFamily: "'Cabinet Grotesk', sans-serif",
              background: tab === t ? 'var(--surface3)' : 'transparent',
              color: tab === t ? 'var(--text)' : 'var(--muted)',
              border: 'none', borderRadius: 7, cursor: 'pointer',
            }}>
              {t === 'rooms' ? 'All Rooms' : t === 'create' ? 'Create Room' : 'Custom (test)'}
            </button>
          ))}
        </div>

        {/* Success/error msg */}
        {createMsg && (
          <div style={{ background: createMsg.includes('Failed') ? 'rgba(240,82,82,0.1)' : 'rgba(45,214,122,0.1)', border: '1px solid ' + (createMsg.includes('Failed') ? 'rgba(240,82,82,0.3)' : 'rgba(45,214,122,0.3)'), borderRadius: 8, padding: '10px 14px', fontSize: 13, color: createMsg.includes('Failed') ? 'var(--red)' : 'var(--green)', marginBottom: 16 }}>
            {createMsg}
          </div>
        )}
        {syncMsg && (
          <div style={{ background: syncMsg.includes('Failed') || syncMsg.includes('No data') ? 'rgba(245,158,11,0.1)' : 'rgba(45,214,122,0.1)', border: '1px solid ' + (syncMsg.includes('Failed') || syncMsg.includes('No data') ? 'rgba(245,158,11,0.3)' : 'rgba(45,214,122,0.3)'), borderRadius: 8, padding: '10px 14px', fontSize: 13, color: syncMsg.includes('Failed') || syncMsg.includes('No data') ? 'var(--amber)' : 'var(--green)', marginBottom: 16 }}>
            {syncMsg}
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
                            <button
                              disabled={!!syncBusy[r.id]}
                              onClick={async () => {
                                setSyncBusy(m => ({ ...m, [r.id]: true }));
                                setSyncMsg('');
                                const result = await refreshSquads(r.id);
                                setSyncBusy(m => ({ ...m, [r.id]: false }));
                                if (result === null) {
                                  setSyncMsg(`Failed to sync squads for ${r.match_name}`);
                                } else if (result.skipped_reason) {
                                  setSyncMsg(`No data from source for ${r.match_name}. Existing squad kept.`);
                                } else {
                                  setSyncMsg(`Synced ${result.players_added ?? 0} players for ${r.match_name}.`);
                                }
                              }}
                              title="Pull current squad from live source (ESPN for football, adapter chain for cricket). May take 10-20s."
                              style={{ padding: '4px 10px', fontSize: 11, fontWeight: 700, borderRadius: 6, background: 'rgba(45,214,122,0.08)', color: 'var(--green)', border: '1px solid rgba(45,214,122,0.25)', cursor: syncBusy[r.id] ? 'not-allowed' : 'pointer', opacity: syncBusy[r.id] ? 0.5 : 1 }}
                            >
                              {syncBusy[r.id] ? 'Syncing…' : 'Sync squad'}
                            </button>
                            <button
                              disabled={!!xiBusy[r.id]}
                              onClick={async () => {
                                setXiBusy(m => ({ ...m, [r.id]: true }));
                                if (r.playing_xi_announced_at) {
                                  const ok = await clearXi(r.id);
                                  setSyncMsg(ok ? `Cleared mock XI on ${r.match_name}.` : `Failed to clear XI on ${r.match_name}.`);
                                } else {
                                  const result = await announceXi(r.id);
                                  if (result === null) {
                                    setSyncMsg(`Failed to announce XI for ${r.match_name}. Sync the squad first?`);
                                  } else {
                                    setSyncMsg(`Mock XI announced for ${r.match_name} (${result.xi_a_count} + ${result.xi_b_count} players).`);
                                  }
                                }
                                setXiBusy(m => ({ ...m, [r.id]: false }));
                              }}
                              title={r.playing_xi_announced_at
                                ? "Clear the mock playing-XI announcement so the banner / Review-team flow can be re-tested."
                                : "Announce a mock XI (auto-picks first 11 from match_squads per team) — bypasses the 5-min Gemini poll for testing."}
                              style={{
                                padding: '4px 10px', fontSize: 11, fontWeight: 700, borderRadius: 6,
                                background: r.playing_xi_announced_at ? 'rgba(45,214,122,0.15)' : 'var(--surface2)',
                                color: r.playing_xi_announced_at ? 'var(--green)' : 'var(--muted)',
                                border: `1px solid ${r.playing_xi_announced_at ? 'rgba(45,214,122,0.4)' : 'var(--border)'}`,
                                cursor: xiBusy[r.id] ? 'not-allowed' : 'pointer',
                                opacity: xiBusy[r.id] ? 0.5 : 1,
                              }}
                            >
                              {xiBusy[r.id] ? '…' : (r.playing_xi_announced_at ? '✓ XI announced' : 'Announce XI (mock)')}
                            </button>
                            <button
                              onClick={async () => {
                                const enabled = !r.late_join_enabled;
                                const ok = await setLateJoin(r.id, enabled);
                                setSyncMsg(ok
                                  ? `Always-on edit window ${enabled ? 'enabled' : 'disabled'} for ${r.match_name}.`
                                  : `Failed to update edit window for ${r.match_name}.`);
                              }}
                              title="Always-on player-edit window: keeps the editor open until the match ends. For a timed window with a duration, use the 'Edit window' Open button instead."
                              style={{
                                padding: '4px 10px', fontSize: 11, fontWeight: 700, borderRadius: 6,
                                background: r.late_join_enabled ? 'rgba(245,158,11,0.15)' : 'var(--surface2)',
                                color: r.late_join_enabled ? 'var(--amber)' : 'var(--muted)',
                                border: `1px solid ${r.late_join_enabled ? 'rgba(245,158,11,0.4)' : 'var(--border)'}`,
                                cursor: 'pointer',
                              }}
                            >
                              {r.late_join_enabled ? '⚡ Always-on edit ON' : 'Always-on edit OFF'}
                            </button>
                            <button
                              onClick={() => setBroadcastRoom(r)}
                              title="Email all users with verified emails about this room"
                              style={{ padding: '4px 10px', fontSize: 11, fontWeight: 700, borderRadius: 6, background: 'rgba(59,130,246,0.08)', color: 'var(--blue)', border: '1px solid rgba(59,130,246,0.25)', cursor: 'pointer' }}
                            >
                              📧 Email users
                            </button>
                            <button onClick={() => { if (confirm(`Delete "${r.match_name}"?`)) deleteRoom(r.id); }} style={{ padding: '4px 10px', fontSize: 11, fontWeight: 700, borderRadius: 6, background: 'rgba(240,82,82,0.08)', color: 'var(--red)', border: '1px solid rgba(240,82,82,0.2)', cursor: 'pointer' }}>
                              Delete
                            </button>
                          </div>
                          {(r.status === 'locked' || r.status === 'open') && (
                            <ReshuffleControls
                              room={r}
                              now={now}
                              busy={!!reshuffleBusy[r.id]}
                              duration={reshuffleDurations[r.id] ?? 300}
                              onChangeDuration={(v) =>
                                setReshuffleDurations((m) => ({ ...m, [r.id]: v }))
                              }
                              onOpen={async () => {
                                const seconds = reshuffleDurations[r.id] ?? 300;
                                setReshuffleBusy((m) => ({ ...m, [r.id]: true }));
                                await openEditWindow(r.id, seconds);
                                setReshuffleBusy((m) => ({ ...m, [r.id]: false }));
                              }}
                              onClose={async () => {
                                setReshuffleBusy((m) => ({ ...m, [r.id]: true }));
                                await closeEditWindow(r.id);
                                setReshuffleBusy((m) => ({ ...m, [r.id]: false }));
                              }}
                            />
                          )}
                          {(r.status === 'locked' || r.status === 'open') && (
                            <PlayerEditControls
                              room={r}
                              now={now}
                              busy={!!playerEditBusy[r.id]}
                              duration={playerEditDurations[r.id] ?? 600}
                              onChangeDuration={(v) =>
                                setPlayerEditDurations((m) => ({ ...m, [r.id]: v }))
                              }
                              onOpen={async () => {
                                const seconds = playerEditDurations[r.id] ?? 600;
                                setPlayerEditBusy((m) => ({ ...m, [r.id]: true }));
                                await openPlayerEditWindow(r.id, seconds);
                                setPlayerEditBusy((m) => ({ ...m, [r.id]: false }));
                              }}
                              onClose={async () => {
                                setPlayerEditBusy((m) => ({ ...m, [r.id]: true }));
                                await closePlayerEditWindow(r.id);
                                setPlayerEditBusy((m) => ({ ...m, [r.id]: false }));
                              }}
                            />
                          )}
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

        {/* ═══ TAB: CUSTOM (TEST) ROOM ═══ */}
        {tab === 'custom' && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 18, fontWeight: 800 }}>
                Spin up a custom test room
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                Useful for QA / E2E flows where the live-matches feed doesn't carry the fixture you want.
                For football: paste an ESPN event id (e.g. <code style={{ background: 'var(--surface2)', padding: '1px 5px', borderRadius: 4 }}>espn_740922</code> for a recent Chelsea v Man Utd) so the squad sync pulls real ESPN rosters.
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, maxWidth: 720 }}>
              <CustomField label="Sport">
                <select value={customSport} onChange={e => setCustomSport(e.target.value as 'cricket' | 'football')} style={fieldStyle}>
                  <option value="football">Football</option>
                  <option value="cricket">Cricket</option>
                </select>
              </CustomField>
              <CustomField label="Match name">
                <input value={customMatchName} onChange={e => setCustomMatchName(e.target.value)} placeholder="Chelsea vs Manchester United" style={fieldStyle} />
              </CustomField>
              <CustomField label="League">
                <input value={customLeague} onChange={e => setCustomLeague(e.target.value)} placeholder="Premier League" style={fieldStyle} />
              </CustomField>
              <CustomField label="Format">
                <input value={customFormat} onChange={e => setCustomFormat(e.target.value)} placeholder="Premier League / T20" style={fieldStyle} />
              </CustomField>
              <CustomField label="Venue">
                <input value={customVenue} onChange={e => setCustomVenue(e.target.value)} placeholder="Stamford Bridge" style={fieldStyle} />
              </CustomField>
              <CustomField label="Season">
                <input value={customSeason} onChange={e => setCustomSeason(e.target.value)} placeholder="2025-26" style={fieldStyle} />
              </CustomField>
              <CustomField label="Match ID (e.g. espn_740922)" hint="Use espn_<event_id> so the squad auto-sync pulls real ESPN rosters. Any unique string also works (Gemini fallback).">
                <input value={customMatchId} onChange={e => setCustomMatchId(e.target.value)} placeholder="espn_740922" style={fieldStyle} />
              </CustomField>
              <CustomField label="Kickoff (local time)">
                <input type="datetime-local" value={customMatchDate} onChange={e => setCustomMatchDate(e.target.value)} style={fieldStyle} />
              </CustomField>
            </div>

            <div style={{ marginTop: 20, display: 'flex', gap: 12 }}>
              <button
                disabled={customSubmitting || !customMatchName.trim()}
                onClick={async () => {
                  setCustomSubmitting(true);
                  setCreateMsg('');
                  // Convert local datetime-input value into ISO with timezone.
                  const isoDate = customMatchDate ? new Date(customMatchDate).toISOString() : undefined;
                  const result = await createRoom({
                    sport: customSport,
                    match_name: customMatchName.trim(),
                    match_format: customFormat.trim(),
                    venue: customVenue.trim(),
                    league: customLeague.trim(),
                    season: customSeason.trim(),
                    match_date: isoDate,
                    match_id: customMatchId.trim() || undefined,
                  });
                  setCustomSubmitting(false);
                  if (result) {
                    setCreateMsg(`Test room created: ${result.match_name}. Squad sync runs in the background — refresh "All Rooms" in ~30s.`);
                    setTab('rooms');
                  } else {
                    setCreateMsg('Failed to create test room — check the match_id and try again.');
                  }
                }}
                className="btn btn-primary"
                style={{ padding: '10px 28px', fontSize: 14, fontWeight: 700 }}
              >
                {customSubmitting ? 'Creating...' : 'Create test room'}
              </button>
              <button
                onClick={() => {
                  // Quick-fill: Chelsea vs Manchester United, ESPN ev 740922.
                  setCustomSport('football');
                  setCustomMatchName('Chelsea vs Manchester United');
                  setCustomLeague('Premier League');
                  setCustomFormat('Premier League');
                  setCustomVenue('Stamford Bridge');
                  setCustomSeason('2025-26');
                  setCustomMatchId('espn_740922');
                }}
                style={{ padding: '10px 18px', fontSize: 13, fontWeight: 600, borderRadius: 7, background: 'var(--surface2)', color: 'var(--muted)', border: '1px solid var(--border)', cursor: 'pointer' }}
              >
                Reset to Chelsea v Man Utd preset
              </button>
            </div>
          </div>
        )}
      </div>
      {broadcastRoom && (
        <BroadcastModal
          room={broadcastRoom}
          onClose={() => setBroadcastRoom(null)}
          getRecipientCount={broadcastRecipients}
          send={broadcastRoomInvite}
        />
      )}
    </div>
  );
}

const fieldStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--surface2)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  padding: '10px 12px',
  fontSize: 13,
  color: 'var(--text)',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
};

function CustomField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 6, fontFamily: "'Cabinet Grotesk', sans-serif", letterSpacing: '0.5px' }}>{label.toUpperCase()}</div>
      {children}
      {hint && <div style={{ fontSize: 10, color: 'var(--faint)', marginTop: 4, lineHeight: 1.4 }}>{hint}</div>}
    </label>
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


/* ─── Reshuffle Controls ─── */
function ReshuffleControls({
  room, now, busy, duration, onChangeDuration, onOpen, onClose,
}: {
  room: { id: string; edit_window_closes_at: string | null };
  now: number;
  busy: boolean;
  duration: number;
  onChangeDuration: (v: number) => void;
  onOpen: () => void;
  onClose: () => void;
}) {
  const closesAtMs = room.edit_window_closes_at ? new Date(room.edit_window_closes_at).getTime() : 0;
  const remainingMs = Math.max(0, closesAtMs - now);
  const isActive = remainingMs > 0;
  const remainingLabel = isActive
    ? remainingMs >= 60_000
      ? `${Math.ceil(remainingMs / 60_000)}m left`
      : `${Math.ceil(remainingMs / 1000)}s left`
    : '';

  return (
    <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <span
        title="Reshuffle window: blind power redistribution only. Users can change power across their existing XI but cannot join or swap players. Use Player edit for joining + swaps."
        style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.5px', color: 'var(--muted)', textTransform: 'uppercase' }}
      >
        Reshuffle
      </span>
      {isActive && (
        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: 'rgba(139,92,246,0.12)', color: 'var(--purple)', border: '1px solid rgba(139,92,246,0.3)' }}>
          ● {remainingLabel}
        </span>
      )}
      <input
        type="number"
        min={30}
        max={1800}
        step={30}
        value={duration}
        onChange={(e) => onChangeDuration(Math.max(30, Math.min(1800, Number(e.target.value) || 300)))}
        title="Duration in seconds (30–1800)"
        style={{ width: 60, fontSize: 11, padding: '3px 6px', borderRadius: 5, background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border)' }}
      />
      <span style={{ fontSize: 10, color: 'var(--muted)' }}>sec</span>
      <button
        disabled={busy}
        onClick={onOpen}
        style={{ padding: '3px 10px', fontSize: 11, fontWeight: 700, borderRadius: 6, background: 'rgba(139,92,246,0.1)', color: 'var(--purple)', border: '1px solid rgba(139,92,246,0.3)', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.5 : 1 }}
      >
        {isActive ? 'Restart' : 'Open'}
      </button>
      <button
        disabled={busy || !isActive}
        onClick={onClose}
        style={{ padding: '3px 10px', fontSize: 11, fontWeight: 700, borderRadius: 6, background: 'var(--surface2)', color: 'var(--muted)', border: '1px solid var(--border)', cursor: busy || !isActive ? 'not-allowed' : 'pointer', opacity: busy || !isActive ? 0.4 : 1 }}
      >
        Close
      </button>
    </div>
  );
}


/* ─── Player Edit Controls ─── */
function PlayerEditControls({
  room, now, busy, duration, onChangeDuration, onOpen, onClose,
}: {
  room: { id: string; player_edit_window_closes_at?: string | null };
  now: number;
  busy: boolean;
  duration: number;
  onChangeDuration: (v: number) => void;
  onOpen: () => void;
  onClose: () => void;
}) {
  const closesAtMs = room.player_edit_window_closes_at ? new Date(room.player_edit_window_closes_at).getTime() : 0;
  const remainingMs = Math.max(0, closesAtMs - now);
  const isActive = remainingMs > 0;
  const remainingLabel = isActive
    ? remainingMs >= 60_000
      ? `${Math.ceil(remainingMs / 60_000)}m left`
      : `${Math.ceil(remainingMs / 1000)}s left`
    : '';

  return (
    <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <span
        title="Player edit window: lets users join the room, swap players, and edit their XI for the duration set. Distinct from Reshuffle (power-only)."
        style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.5px', color: 'var(--muted)', textTransform: 'uppercase' }}
      >
        Player edit
      </span>
      {isActive && (
        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: 'rgba(45,214,122,0.12)', color: 'var(--green)', border: '1px solid rgba(45,214,122,0.3)' }}>
          ● {remainingLabel}
        </span>
      )}
      <input
        type="number"
        min={30}
        max={14400}
        step={60}
        value={duration}
        onChange={(e) => onChangeDuration(Math.max(30, Math.min(14400, Number(e.target.value) || 600)))}
        title="Duration in seconds (30–14400, i.e. up to 4 hours)"
        style={{ width: 70, fontSize: 11, padding: '3px 6px', borderRadius: 5, background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border)' }}
      />
      <span style={{ fontSize: 10, color: 'var(--muted)' }}>sec</span>
      <button
        disabled={busy}
        onClick={onOpen}
        style={{ padding: '3px 10px', fontSize: 11, fontWeight: 700, borderRadius: 6, background: 'rgba(45,214,122,0.1)', color: 'var(--green)', border: '1px solid rgba(45,214,122,0.3)', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.5 : 1 }}
      >
        {isActive ? 'Restart' : 'Open'}
      </button>
      <button
        disabled={busy || !isActive}
        onClick={onClose}
        style={{ padding: '3px 10px', fontSize: 11, fontWeight: 700, borderRadius: 6, background: 'var(--surface2)', color: 'var(--muted)', border: '1px solid var(--border)', cursor: busy || !isActive ? 'not-allowed' : 'pointer', opacity: busy || !isActive ? 0.4 : 1 }}
      >
        Close
      </button>
    </div>
  );
}


/* ─── Broadcast Modal ─── */
function BroadcastModal({
  room, onClose, getRecipientCount, send,
}: {
  room: AdminRoom;
  onClose: () => void;
  getRecipientCount: () => Promise<number | null>;
  send: (
    roomId: string,
    body: { subject?: string; intro?: string; test_email?: string },
  ) => Promise<{
    sent: number;
    failed: number;
    total: number;
    test?: boolean;
    error?: string;
    failures?: { email: string; error: string }[];
  } | null>;
}) {
  const [subject, setSubject] = useState(`Join the ${room.match_name} room on Crowdbash`);
  const [intro, setIntro] = useState(
    "Today's match is starting soon — drop into the room, pick your XI, and play live."
  );
  const [testEmail, setTestEmail] = useState('');
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [busy, setBusy] = useState<'test' | 'all' | null>(null);
  const [result, setResult] = useState<string>('');
  const [failedList, setFailedList] = useState<{ email: string; error: string }[]>([]);

  useEffect(() => {
    let alive = true;
    getRecipientCount().then(c => { if (alive) setRecipientCount(c); });
    return () => { alive = false; };
  }, [getRecipientCount]);

  const sendTest = async () => {
    if (!testEmail.trim()) return;
    setBusy('test');
    setResult('');
    setFailedList([]);
    const r = await send(room.id, { subject, intro, test_email: testEmail.trim() });
    setBusy(null);
    if (!r) setResult('Request failed.');
    else if (r.failed > 0) setResult(`Test send failed${r.error ? `: ${r.error}` : ''}.`);
    else setResult(`Test email sent to ${testEmail.trim()}.`);
  };

  const sendAll = async () => {
    if (recipientCount === null) return;
    if (!confirm(`Send this email to ${recipientCount} user${recipientCount === 1 ? '' : 's'}?`)) return;
    setBusy('all');
    setResult('');
    setFailedList([]);
    const r = await send(room.id, { subject, intro });
    setBusy(null);
    if (!r) setResult('Broadcast failed.');
    else {
      setResult(`Sent ${r.sent} of ${r.total} (${r.failed} failed).`);
      setFailedList(r.failures || []);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 100, padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 520, background: 'var(--surface)',
          border: '1px solid var(--border)', borderRadius: 12,
          padding: 24, maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 18, fontWeight: 800 }}>Email users</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{room.match_name}</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        <CustomField label="Subject">
          <input value={subject} onChange={e => setSubject(e.target.value)} style={fieldStyle} />
        </CustomField>
        <div style={{ height: 12 }} />
        <CustomField label="Message" hint="Plain text. Newlines become line breaks.">
          <textarea
            value={intro}
            onChange={e => setIntro(e.target.value)}
            rows={4}
            style={{ ...fieldStyle, resize: 'vertical', fontFamily: 'inherit' }}
          />
        </CustomField>

        <div style={{ height: 16 }} />
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <CustomField label="Test email (optional)" hint="Send a single preview to this address before broadcasting.">
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="email"
                value={testEmail}
                onChange={e => setTestEmail(e.target.value)}
                placeholder="you@example.com"
                style={fieldStyle}
              />
              <button
                disabled={busy !== null || !testEmail.trim()}
                onClick={sendTest}
                style={{ padding: '0 16px', fontSize: 13, fontWeight: 700, borderRadius: 7, background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border)', cursor: busy ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', opacity: busy === 'test' ? 0.5 : 1 }}
              >
                {busy === 'test' ? 'Sending…' : 'Send test'}
              </button>
            </div>
          </CustomField>
        </div>

        {result && (
          <div style={{ marginTop: 16, fontSize: 13, color: result.includes('failed') || result.includes('Failed') ? 'var(--red)' : 'var(--green)' }}>
            {result}
          </div>
        )}
        {failedList.length > 0 && (
          <details style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>
            <summary style={{ cursor: 'pointer', color: 'var(--text2)' }}>
              Show {failedList.length} failed address{failedList.length === 1 ? '' : 'es'}
            </summary>
            <ul style={{ margin: '8px 0 0 0', paddingLeft: 20, lineHeight: 1.5 }}>
              {failedList.map((f, i) => (
                <li key={i}>
                  <span style={{ color: 'var(--text2)' }}>{f.email}</span>
                  <span style={{ color: 'var(--faint)' }}> — {f.error}</span>
                </li>
              ))}
            </ul>
          </details>
        )}

        <div style={{ marginTop: 24, display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ padding: '10px 18px', fontSize: 13, fontWeight: 600, borderRadius: 7, background: 'var(--surface2)', color: 'var(--muted)', border: '1px solid var(--border)', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            disabled={busy !== null || recipientCount === null || recipientCount === 0}
            onClick={sendAll}
            className="btn btn-primary"
            style={{ padding: '10px 22px', fontSize: 14, fontWeight: 700 }}
          >
            {busy === 'all'
              ? 'Sending…'
              : recipientCount === null
                ? 'Loading…'
                : `Send to ${recipientCount} user${recipientCount === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
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
