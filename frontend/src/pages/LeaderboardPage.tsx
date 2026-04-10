import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../hooks/useAuth';

interface LeaderboardEntry {
  user_id: string;
  username: string;
  first_name: string;
  points: number;
  strategy: string;
}

interface RoomInfo {
  match_name: string;
  sport: string;
  league: string;
  status: string;
}

const AVATAR_STYLES = [
  { bg: 'rgba(45,214,122,0.12)', color: 'var(--green)' },
  { bg: 'rgba(168,176,192,0.12)', color: '#A8B4C0' },
  { bg: 'rgba(205,143,90,0.12)', color: '#CD8F5A' },
  { bg: 'rgba(59,130,246,0.15)', color: 'var(--blue)' },
  { bg: 'rgba(240,90,90,0.1)', color: 'var(--red)' },
  { bg: 'rgba(139,92,246,0.1)', color: 'var(--purple)' },
];

const RANK_COLORS = ['var(--green)', '#A8B4C0', '#CD8F5A'];

export function LeaderboardPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const { user } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roomId) { setLoading(false); return; }

    async function fetchData() {
      setLoading(true);
      try {
        const [lbRes, roomRes] = await Promise.all([
          api.get(`/api/leaderboard/${roomId}`),
          api.get(`/api/rooms/${roomId}`),
        ]);
        if (Array.isArray(lbRes.data)) setEntries(lbRes.data);
        if (roomRes.data) setRoom(roomRes.data);
      } catch (err) {
        console.error('Leaderboard fetch error', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [roomId]);

  const getInitials = (name: string) => {
    const parts = name.replace(/[_]/g, ' ').split(/\s+/);
    return parts.map(p => p[0] || '').join('').slice(0, 2).toUpperCase();
  };

  return (
    <main style={{ paddingTop: 60, minHeight: '100vh' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 20px' }}>
        <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 26, fontWeight: 900, marginBottom: 4 }}>
          Leaderboard
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 24 }}>
          {room ? (
            <>
              {room.match_name} &middot; {room.league || room.sport}
              {room.status === 'live' && <span style={{ color: 'var(--red)', marginLeft: 8 }}>● LIVE</span>}
            </>
          ) : roomId ? 'Loading...' : 'Select a room to view leaderboard'}
        </div>

        {!roomId && (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--muted)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏆</div>
            <div style={{ fontSize: 15, marginBottom: 8 }}>No room selected</div>
            <Link to="/games" style={{ color: 'var(--green)', fontSize: 14, fontWeight: 600 }}>Browse games →</Link>
          </div>
        )}

        {loading && roomId && (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--muted)' }}>Loading leaderboard...</div>
        )}

        {!loading && roomId && entries.length === 0 && (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--muted)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
            <div style={{ fontSize: 15 }}>No players yet — be the first to join!</div>
          </div>
        )}

        {!loading && entries.length > 0 && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '50px 44px 1fr 130px 80px',
              alignItems: 'center',
              padding: '10px 16px',
              borderBottom: '1px solid var(--border)',
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: 'var(--muted)',
            }}>
              <div>Rank</div>
              <div></div>
              <div>Player</div>
              <div>Strategy</div>
              <div style={{ textAlign: 'right' }}>Points</div>
            </div>

            {/* Rows */}
            {entries.map((entry, i) => {
              const isYou = user?.id === entry.user_id;
              const avStyle = AVATAR_STYLES[i % AVATAR_STYLES.length];
              const rankColor = i < 3 ? RANK_COLORS[i] : 'var(--muted)';

              return (
                <div
                  key={entry.user_id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '50px 44px 1fr 130px 80px',
                    alignItems: 'center',
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--border)',
                    background: isYou ? 'rgba(45,214,122,0.04)' : 'transparent',
                    borderLeft: isYou ? '2px solid var(--green)' : 'none',
                  }}
                >
                  <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 900, color: rankColor }}>
                    {i + 1}
                  </div>
                  <div style={{
                    width: 34, height: 34, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700,
                    background: avStyle.bg, color: avStyle.color,
                  }}>
                    {getInitials(entry.username)}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>
                    {entry.username}
                    {isYou && (
                      <span style={{
                        fontSize: 10, marginLeft: 6, padding: '1px 7px', borderRadius: 20,
                        background: 'rgba(45,214,122,0.15)', color: 'var(--green)',
                      }}>
                        You
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                    {entry.strategy || '—'}
                  </div>
                  <div style={{
                    textAlign: 'right',
                    fontFamily: "'Cabinet Grotesk', sans-serif",
                    fontSize: 15, fontWeight: 700,
                    color: 'var(--green)',
                  }}>
                    {entry.points.toLocaleString()}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {room && (
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <Link to={`/room/${roomId}`} style={{ fontSize: 13, fontWeight: 600, color: 'var(--green)' }}>
              ← Back to room
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
