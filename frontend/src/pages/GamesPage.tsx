import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import type { Room } from '../types';
import { formatMatchDate } from '../types';

type Filter = 'all' | 'cricket' | 'football' | 'live' | 'upcoming';

export function GamesPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    async function fetch(retry = 0) {
      try {
        const { data } = await api.get('/api/rooms/');
        if (Array.isArray(data)) setRooms(data);
      } catch {
        if (retry < 3) { await new Promise(r => setTimeout(r, 3000)); return fetch(retry + 1); }
      } finally { setLoading(false); }
    }
    fetch();
  }, []);

  const filtered = rooms.filter(r => {
    if (filter === 'cricket') return r.sport === 'cricket';
    if (filter === 'football') return r.sport === 'football';
    if (filter === 'live') return r.status === 'live';
    if (filter === 'upcoming') return r.status === 'upcoming';
    return true;
  });

  const live = filtered.filter(r => r.status === 'live');
  const upcoming = filtered.filter(r => r.status === 'upcoming').sort((a, b) => {
    const da = a.match_date ? new Date(a.match_date).getTime() : Infinity;
    const db = b.match_date ? new Date(b.match_date).getTime() : Infinity;
    return da - db;
  });
  const completed = filtered.filter(r => r.status === 'completed').sort((a, b) => {
    const da = a.match_date ? new Date(a.match_date).getTime() : 0;
    const db = b.match_date ? new Date(b.match_date).getTime() : 0;
    return db - da;
  }).slice(0, 6);

  const filters: Array<{ key: Filter; label: string; icon?: string }> = [
    { key: 'all', label: 'All sports' },
    { key: 'cricket', label: 'Cricket', icon: '🏏' },
    { key: 'football', label: 'Football', icon: '⚽' },
    { key: 'live', label: 'Live' },
    { key: 'upcoming', label: 'Upcoming' },
  ];

  return (
    <div style={{ paddingTop: 60, minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ padding: '40px 36px 28px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 38, fontWeight: 900, letterSpacing: '-1.5px', marginBottom: 4 }}>Live games</h1>
            <div className="text-[13px]" style={{ color: 'var(--muted)' }}>Find a room and join the action</div>
          </div>
          <div className="flex items-center gap-2.5">
            {live.length > 0 && (
              <span className="badge badge-live"><span className="animate-pulse-slow">●</span> {live.length} LIVE NOW</span>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '20px 36px', display: 'flex', gap: 7, flexWrap: 'wrap' }}>
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`fchip ${filter === f.key ? 'active' : ''}`}
          >
            {f.icon && <span>{f.icon} </span>}{f.label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 36px 60px' }}>
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-10">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse rounded-[14px]" style={{ background: 'var(--surface)', border: '1px solid var(--border)', height: 180 }} />
            ))}
          </div>
        )}

        {!loading && live.length > 0 && (
          <>
            <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '2px', color: 'var(--muted)', marginBottom: 14 }}>LIVE NOW</div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-10">
              {live.map(r => <GCard key={r.id} room={r} />)}
            </div>
          </>
        )}

        {!loading && upcoming.length > 0 && (
          <>
            <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '2px', color: 'var(--muted)', marginBottom: 14 }}>UPCOMING</div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-10">
              {upcoming.map(r => <GCard key={r.id} room={r} />)}
            </div>
          </>
        )}

        {!loading && completed.length > 0 && (
          <>
            <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '2px', color: 'var(--muted)', marginBottom: 14 }}>RECENT RESULTS</div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-10">
              {completed.map(r => <GCard key={r.id} room={r} />)}
            </div>
          </>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-20">
            <div className="text-3xl mb-4">🏟️</div>
            <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 18, fontWeight: 800, marginBottom: 4 }}>No games found</div>
            <div className="text-[13px]" style={{ color: 'var(--muted)' }}>Games appear automatically when matches are scheduled</div>
          </div>
        )}
      </div>
    </div>
  );
}

function GCard({ room }: { room: Room }) {
  const parts = room.match_name.split(' vs ');
  const t1 = parts[0]?.trim() || 'TBD';
  const t2 = parts[1]?.trim() || 'TBD';
  const a1 = t1.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase();
  const a2 = t2.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase();
  const isLive = room.status === 'live';
  const isCompleted = room.status === 'completed';
  const isCricket = room.sport === 'cricket';

  const mp = room.match_progress || {};
  const result = (mp.result as string) || '';

  return (
    <Link to={`/room/${room.id}`} className="block no-underline transition-all hover:-translate-y-1" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
      <div style={{ padding: '18px 18px 14px', borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-3">
          {isLive ? (
            <span className="badge badge-live" style={{ fontSize: 10 }}><span className="animate-pulse-slow">●</span> LIVE</span>
          ) : isCompleted ? (
            <span className="badge badge-muted" style={{ fontSize: 10 }}>FT</span>
          ) : (
            <span className="badge badge-amber" style={{ fontSize: 10 }}>{formatMatchDate(room.match_date)}</span>
          )}
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '1.5px', fontFamily: "'Cabinet Grotesk', sans-serif", padding: '3px 8px', borderRadius: 4, color: isCricket ? 'var(--amber)' : 'var(--blue)', background: isCricket ? 'rgba(245,158,11,0.08)' : 'rgba(59,130,246,0.08)' }}>
            {isCricket ? '🏏' : '⚽'} {room.match_format || room.league || ''}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="text-center flex-1">
            <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 24, fontWeight: 900, letterSpacing: '-0.5px' }}>{a1}</div>
            {isCompleted && result ? (
              <div className="text-[11px]" style={{ color: 'var(--muted)' }}>{((mp.teams as Array<{score: string}>)?.[0]?.score) || ''}</div>
            ) : (
              <div className="text-[11px]" style={{ color: 'var(--muted)' }}>{t1.length > 12 ? t1.slice(0, 12) + '...' : t1}</div>
            )}
          </div>
          <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 10, fontWeight: 700, color: 'var(--faint)', padding: '0 12px' }}>vs</div>
          <div className="text-center flex-1">
            <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 24, fontWeight: 900, letterSpacing: '-0.5px' }}>{a2}</div>
            {isCompleted && result ? (
              <div className="text-[11px]" style={{ color: 'var(--muted)' }}>{((mp.teams as Array<{score: string}>)?.[1]?.score) || ''}</div>
            ) : (
              <div className="text-[11px]" style={{ color: 'var(--muted)' }}>{t2.length > 12 ? t2.slice(0, 12) + '...' : t2}</div>
            )}
          </div>
        </div>
        {isCompleted && result && (
          <div className="text-center text-[11px] mt-2 font-semibold" style={{ color: 'var(--green)' }}>{result.length > 40 ? result.slice(0, 40) + '...' : result}</div>
        )}
      </div>
      <div style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="text-[11px]" style={{ color: 'var(--muted)' }}>{room.league || ''}</div>
        <div className="flex items-center gap-2">
          {!isCompleted && <span style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 12, fontWeight: 700, color: 'var(--green)', background: 'rgba(45,214,122,0.08)', borderRadius: 6, padding: '3px 9px' }}>₹10</span>}
          <span className="btn btn-primary" style={{ padding: '6px 16px', fontSize: 12, borderRadius: 7 }}>
            {isLive ? 'Join' : isCompleted ? 'View' : 'Play'}
          </span>
        </div>
      </div>
    </Link>
  );
}
