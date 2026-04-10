import { useState, useEffect } from 'react';
import { useAdminStore, type UpcomingMatch } from '../store/adminStore';

export function AdminPage() {
  const { isLoggedIn, login, logout, rooms, loading, fetchRooms, createRoom, updateStatus, deleteRoom, fetchMatches, matchSuggestions, fetchingMatches } = useAdminStore();
  const [tab, setTab] = useState<'rooms' | 'create' | 'fetch'>('rooms');

  // Login form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Room filters
  const [filterSport, setFilterSport] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Create form
  const [form, setForm] = useState({
    sport: 'cricket',
    match_name: '',
    match_format: '',
    venue: '',
    league: '',
    season: '',
    match_date: '',
    match_id: '',
  });
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState('');

  useEffect(() => {
    if (isLoggedIn) fetchRooms(filterSport || undefined, filterStatus || undefined);
  }, [isLoggedIn, filterSport, filterStatus, fetchRooms]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');
    const ok = await login(username, password);
    if (!ok) setLoginError('Invalid credentials');
    setLoginLoading(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.match_name.trim()) return;
    setCreating(true);
    setCreateMsg('');
    const result = await createRoom({
      ...form,
      match_date: form.match_date || undefined,
      match_id: form.match_id || undefined,
    });
    if (result) {
      setCreateMsg(`Room created: ${result.match_name}`);
      setForm({ sport: 'cricket', match_name: '', match_format: '', venue: '', league: '', season: '', match_date: '', match_id: '' });
    } else {
      setCreateMsg('Failed to create room');
    }
    setCreating(false);
  };

  const fillFromSuggestion = (m: UpcomingMatch) => {
    setForm({
      sport: tab === 'fetch' ? form.sport : 'cricket',
      match_name: m.match_name,
      match_format: m.match_format,
      venue: m.venue,
      league: m.league,
      season: m.season,
      match_date: m.match_date ? m.match_date.replace('Z', '').slice(0, 16) : '',
      match_id: m.match_id || '',
    });
    setTab('create');
  };

  // ─── NOT LOGGED IN ───
  if (!isLoggedIn) {
    return (
      <div style={{ paddingTop: 60, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <form onSubmit={handleLogin} style={{ width: 380, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 36 }}>
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
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Manage rooms, create matches, control status</div>
          </div>
          <button onClick={logout} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 18px', fontSize: 13, fontWeight: 600, color: 'var(--muted)', cursor: 'pointer' }}>
            Logout
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, background: 'var(--surface)', borderRadius: 'var(--radius-sm)', padding: 4, marginBottom: 24 }}>
          {(['rooms', 'create', 'fetch'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: '10px 0', fontSize: 13, fontWeight: 700, fontFamily: "'Cabinet Grotesk', sans-serif",
              background: tab === t ? 'var(--surface3)' : 'transparent',
              color: tab === t ? 'var(--text)' : 'var(--muted)',
              border: 'none', borderRadius: 7, cursor: 'pointer', textTransform: 'capitalize',
            }}>
              {t === 'rooms' ? 'All Rooms' : t === 'create' ? 'Create Room' : 'Fetch Matches'}
            </button>
          ))}
        </div>

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
              {['', 'live', 'upcoming', 'completed'].map(s => (
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
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>No rooms found</div>
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
                        <td style={{ padding: '12px', fontWeight: 600, maxWidth: 200 }}>{r.match_name}</td>
                        <td style={{ padding: '12px' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: r.sport === 'cricket' ? 'rgba(245,158,11,0.08)' : 'rgba(59,130,246,0.08)', color: r.sport === 'cricket' ? 'var(--amber)' : 'var(--blue)' }}>
                            {r.sport === 'cricket' ? '🏏' : '⚽'} {r.sport}
                          </span>
                        </td>
                        <td style={{ padding: '12px', color: 'var(--text2)' }}>{r.league || '—'}</td>
                        <td style={{ padding: '12px', color: 'var(--muted)' }}>{r.match_format || '—'}</td>
                        <td style={{ padding: '12px', color: 'var(--muted)', fontSize: 12 }}>{r.match_date ? new Date(r.match_date).toLocaleString() : '—'}</td>
                        <td style={{ padding: '12px' }}>
                          <StatusBadge status={r.status} />
                        </td>
                        <td style={{ padding: '12px', color: 'var(--text2)' }}>{r.fan_count}</td>
                        <td style={{ padding: '12px' }}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            {r.status === 'upcoming' && (
                              <button onClick={() => updateStatus(r.id, 'live')} style={{ padding: '4px 10px', fontSize: 11, fontWeight: 700, borderRadius: 6, background: 'rgba(45,214,122,0.1)', color: 'var(--green)', border: '1px solid rgba(45,214,122,0.3)', cursor: 'pointer' }}>
                                Go Live
                              </button>
                            )}
                            {r.status === 'live' && (
                              <button onClick={() => updateStatus(r.id, 'completed')} style={{ padding: '4px 10px', fontSize: 11, fontWeight: 700, borderRadius: 6, background: 'rgba(139,92,246,0.1)', color: 'var(--purple)', border: '1px solid rgba(139,92,246,0.3)', cursor: 'pointer' }}>
                                Complete
                              </button>
                            )}
                            {r.status === 'completed' && (
                              <button onClick={() => updateStatus(r.id, 'upcoming')} style={{ padding: '4px 10px', fontSize: 11, fontWeight: 700, borderRadius: 6, background: 'var(--surface2)', color: 'var(--muted)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                                Reset
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
              </div>
            )}
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--muted)' }}>
              {rooms.length} room{rooms.length !== 1 ? 's' : ''} total
            </div>
          </div>
        )}

        {/* ═══ TAB: CREATE ROOM ═══ */}
        {tab === 'create' && (
          <form onSubmit={handleCreate} style={{ maxWidth: 560, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 28 }}>
            <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 18, fontWeight: 800, marginBottom: 20 }}>Create a new room</div>

            {createMsg && (
              <div style={{ background: createMsg.includes('Failed') ? 'rgba(240,82,82,0.1)' : 'rgba(45,214,122,0.1)', border: '1px solid ' + (createMsg.includes('Failed') ? 'rgba(240,82,82,0.3)' : 'rgba(45,214,122,0.3)'), borderRadius: 8, padding: '10px 14px', fontSize: 13, color: createMsg.includes('Failed') ? 'var(--red)' : 'var(--green)', marginBottom: 16 }}>
                {createMsg}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <FieldGroup label="Sport">
                <select value={form.sport} onChange={e => setForm({ ...form, sport: e.target.value })} style={selectStyle}>
                  <option value="cricket">Cricket</option>
                  <option value="football">Football</option>
                </select>
              </FieldGroup>
              <FieldGroup label="Format">
                <input value={form.match_format} onChange={e => setForm({ ...form, match_format: e.target.value })} placeholder="T20, ODI, League..." style={inputStyle} />
              </FieldGroup>
            </div>

            <FieldGroup label="Match name *">
              <input value={form.match_name} onChange={e => setForm({ ...form, match_name: e.target.value })} placeholder="Team A vs Team B" style={inputStyle} required />
            </FieldGroup>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
              <FieldGroup label="League">
                <input value={form.league} onChange={e => setForm({ ...form, league: e.target.value })} placeholder="IPL, EPL..." style={inputStyle} />
              </FieldGroup>
              <FieldGroup label="Season">
                <input value={form.season} onChange={e => setForm({ ...form, season: e.target.value })} placeholder="2026" style={inputStyle} />
              </FieldGroup>
            </div>

            <FieldGroup label="Venue" style={{ marginTop: 14 }}>
              <input value={form.venue} onChange={e => setForm({ ...form, venue: e.target.value })} placeholder="Stadium, City" style={inputStyle} />
            </FieldGroup>

            <FieldGroup label="Match date & time" style={{ marginTop: 14 }}>
              <input type="datetime-local" value={form.match_date} onChange={e => setForm({ ...form, match_date: e.target.value })} style={inputStyle} />
            </FieldGroup>

            <button type="submit" disabled={creating} className="btn btn-primary" style={{ width: '100%', padding: '12px 0', fontSize: 14, fontWeight: 700, marginTop: 22 }}>
              {creating ? 'Creating...' : 'Create Room'}
            </button>
          </form>
        )}

        {/* ═══ TAB: FETCH MATCHES ═══ */}
        {tab === 'fetch' && (
          <div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
              <button onClick={() => { setForm(f => ({ ...f, sport: 'cricket' })); fetchMatches('cricket'); }} disabled={fetchingMatches} style={{ padding: '12px 24px', fontSize: 14, fontWeight: 700, fontFamily: "'Cabinet Grotesk', sans-serif", borderRadius: 'var(--radius-sm)', background: 'rgba(245,158,11,0.1)', color: 'var(--amber)', border: '1px solid rgba(245,158,11,0.3)', cursor: 'pointer' }}>
                {fetchingMatches ? '...' : '🏏 Fetch Cricket Matches'}
              </button>
              <button onClick={() => { setForm(f => ({ ...f, sport: 'football' })); fetchMatches('football'); }} disabled={fetchingMatches} style={{ padding: '12px 24px', fontSize: 14, fontWeight: 700, fontFamily: "'Cabinet Grotesk', sans-serif", borderRadius: 'var(--radius-sm)', background: 'rgba(59,130,246,0.1)', color: 'var(--blue)', border: '1px solid rgba(59,130,246,0.3)', cursor: 'pointer' }}>
                {fetchingMatches ? '...' : '⚽ Fetch Football Matches'}
              </button>
            </div>

            {fetchingMatches && (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
                Fetching upcoming matches from APIs... (this may take 10-15 seconds)
              </div>
            )}

            {!fetchingMatches && matchSuggestions.length === 0 && (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
                Click a button above to fetch upcoming matches (CricketData / Football-Data / Gemini)
              </div>
            )}

            {matchSuggestions.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
                {matchSuggestions.map((m, i) => (
                  <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 16, fontWeight: 800, flex: 1 }}>{m.match_name}</div>
                      {m.source && (
                        <span style={{
                          fontSize: 9, fontWeight: 700, letterSpacing: '0.5px', padding: '2px 7px', borderRadius: 4,
                          background: m.source === 'gemini' ? 'rgba(139,92,246,0.1)' : 'rgba(45,214,122,0.1)',
                          color: m.source === 'gemini' ? 'var(--purple)' : 'var(--green)',
                          border: `1px solid ${m.source === 'gemini' ? 'rgba(139,92,246,0.3)' : 'rgba(45,214,122,0.3)'}`,
                          textTransform: 'uppercase',
                        }}>
                          {m.source}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>
                      {m.league} {m.match_format ? `\u00b7 ${m.match_format}` : ''}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>{m.venue}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>
                      {m.match_date ? new Date(m.match_date).toLocaleString() : 'TBD'}
                    </div>
                    {m.match_id && <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 10, fontFamily: 'monospace' }}>ID: {m.match_id}</div>}
                    <button onClick={() => fillFromSuggestion(m)} style={{ padding: '8px 18px', fontSize: 12, fontWeight: 700, fontFamily: "'Cabinet Grotesk', sans-serif", borderRadius: 7, background: 'var(--green)', color: '#071a0e', border: 'none', cursor: 'pointer' }}>
                      + Create Room
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Helpers ─── */

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; color: string; border: string }> = {
    live: { bg: 'rgba(240,82,82,0.1)', color: 'var(--red)', border: 'rgba(240,82,82,0.3)' },
    upcoming: { bg: 'rgba(245,158,11,0.1)', color: 'var(--amber)', border: 'rgba(245,158,11,0.3)' },
    completed: { bg: 'rgba(139,92,246,0.1)', color: 'var(--purple)', border: 'rgba(139,92,246,0.3)' },
  };
  const c = colors[status] || colors.upcoming;
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 5, background: c.bg, color: c.color, border: `1px solid ${c.border}`, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
      {status === 'live' && '● '}{status}
    </span>
  );
}

function FieldGroup({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={style}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--surface2)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  padding: '10px 14px',
  fontSize: 14,
  color: 'var(--text)',
  outline: 'none',
  boxSizing: 'border-box',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: 'none',
  cursor: 'pointer',
};
