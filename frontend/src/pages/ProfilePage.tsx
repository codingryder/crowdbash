import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import api from '../lib/api';
import { useAuthStore } from '../store/authStore';

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
            className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold"
            style={{ fontFamily: "'Cabinet Grotesk', sans-serif", background: 'rgba(45,214,122,0.12)', color: 'var(--green)' }}
          >
            {(user.first_name?.[0] || '').toUpperCase()}{(user.last_name?.[0] || '').toUpperCase()}
          </div>
          <div>
            <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 20, fontWeight: 900 }}>
              {user.first_name} {user.last_name}
            </div>
            <div className="text-[12px]" style={{ color: 'var(--muted)' }}>@{user.username}</div>
            <div className="text-[12px]" style={{ color: 'var(--muted)' }}>{user.email}</div>
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
                <div key={item.label} className="flex justify-between py-2" style={{ borderBottom: '1px solid var(--border)' }}>
                  <span className="text-[12px]" style={{ color: 'var(--muted)' }}>{item.label}</span>
                  <span className="text-[13px] font-medium">{item.value}</span>
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
    </main>
  );
}
