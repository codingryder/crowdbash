import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../lib/api';
import type { Room } from '../types';
import { formatMatchDate } from '../types';
import { MatchSummaryCard } from '../components/room/MatchSummaryCard';

export function LeaguePage() {
  const { leagueName } = useParams<{ leagueName: string }>();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  const decodedLeague = decodeURIComponent(leagueName || '');

  useEffect(() => {
    async function fetchRooms() {
      try {
        const { data } = await api.get('/api/rooms/', {
          params: { league: decodedLeague },
        });
        if (Array.isArray(data)) setRooms(data);
      } catch {
        // Backend not available
      } finally {
        setLoading(false);
      }
    }
    if (decodedLeague) fetchRooms();
  }, [decodedLeague]);

  const liveRooms = rooms.filter((r) => r.status === 'live');

  // Upcoming: soonest match first (ascending by date)
  const upcomingRooms = rooms
    .filter((r) => r.status === 'upcoming')
    .sort((a, b) => {
      const da = a.match_date ? new Date(a.match_date).getTime() : Infinity;
      const db = b.match_date ? new Date(b.match_date).getTime() : Infinity;
      return da - db;
    });

  // Completed: most recent first (descending by date)
  const completedRooms = rooms
    .filter((r) => r.status === 'completed')
    .sort((a, b) => {
      const da = a.match_date ? new Date(a.match_date).getTime() : 0;
      const db = b.match_date ? new Date(b.match_date).getTime() : 0;
      return db - da;
    });
  const sport = rooms[0]?.sport || 'cricket';
  const sportIcon = sport === 'football' ? '⚽' : '🏏';

  return (
    <main style={{ padding: '28px 32px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6">
        <Link to="/" className="text-xs no-underline" style={{ color: 'var(--gold)' }}>
          Home
        </Link>
        <span className="text-[10px]" style={{ color: 'var(--dm)' }}>/</span>
        <span className="text-xs" style={{ color: 'var(--mu)' }}>{decodedLeague}</span>
      </div>

      {/* Header */}
      <div className="mb-6">
        <div className="font-syne text-[22px] font-extrabold mb-1">
          {sportIcon} {decodedLeague}
        </div>
        <div className="text-[13px]" style={{ color: 'var(--mu)' }}>
          {rooms.length} match{rooms.length !== 1 ? 'es' : ''} &middot;
          {liveRooms.length > 0 && (
            <span style={{ color: 'var(--green)' }}> {liveRooms.length} live</span>
          )}
          {upcomingRooms.length > 0 && (
            <span> {upcomingRooms.length} upcoming</span>
          )}
        </div>
      </div>

      {loading && (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-[14px] p-[18px] animate-pulse" style={{ background: 'var(--s1)', border: '0.5px solid var(--b1)' }}>
              <div className="h-4 rounded w-1/3 mb-3" style={{ background: 'var(--s2)' }} />
              <div className="h-6 rounded w-2/3" style={{ background: 'var(--s2)' }} />
            </div>
          ))}
        </div>
      )}

      {/* Live matches */}
      {!loading && liveRooms.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-1.5 h-1.5 rounded-full animate-blink" style={{ background: 'var(--red)' }} />
            <span className="text-[11px] uppercase tracking-[1px] font-semibold" style={{ color: 'var(--red)' }}>
              Live now
            </span>
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
            {liveRooms.map((room) => (
              <MatchCard key={room.id} room={room} />
            ))}
          </div>
        </section>
      )}

      {/* Upcoming matches */}
      {!loading && upcomingRooms.length > 0 && (
        <section className="mb-8">
          <div className="text-[11px] uppercase tracking-[1px] mb-3" style={{ color: 'var(--mu)' }}>
            Upcoming
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
            {upcomingRooms.map((room) => (
              <MatchCard key={room.id} room={room} />
            ))}
          </div>
        </section>
      )}

      {/* Recent Results — completed matches with summaries */}
      {!loading && completedRooms.length > 0 && (
        <section className="mb-8">
          <div className="text-[11px] uppercase tracking-[1px] mb-3" style={{ color: 'var(--mu)' }}>
            Recent Results
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
            {completedRooms.slice(0, 3).map((room) => (
              <MatchSummaryCard key={room.id} room={room} />
            ))}
          </div>
        </section>
      )}

      {/* Empty */}
      {!loading && rooms.length === 0 && (
        <div className="text-center py-16">
          <div className="font-syne text-lg mb-2" style={{ color: 'var(--mu)' }}>
            No matches found for {decodedLeague}
          </div>
          <Link to="/" className="text-xs no-underline" style={{ color: 'var(--gold)' }}>
            Back to home
          </Link>
        </div>
      )}
    </main>
  );
}

function MatchCard({ room }: { room: Room }) {
  const isLive = room.status === 'live';

  // Format progress
  let progressText = '';
  if (room.sport === 'cricket' && room.current_over > 0) {
    progressText = `Over ${room.current_over}`;
  } else if (room.sport === 'football') {
    const mp = room.match_progress || {};
    const minute = mp.minute as number;
    if (minute) {
      progressText = `${minute}' ${(mp.half as number) === 1 ? '1H' : '2H'}`;
    }
  }

  return (
    <Link
      to={`/room/${room.id}`}
      className="block rounded-[14px] p-4 no-underline transition-all"
      style={{
        background: 'var(--s1)',
        border: isLive ? '0.5px solid rgba(240,90,90,0.2)' : '0.5px solid var(--b1)',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(244,185,64,0.4)')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = isLive ? 'rgba(240,90,90,0.2)' : 'var(--b1)')}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px]" style={{ color: 'var(--mu)' }}>
          {room.match_format || room.venue}
        </span>
        {isLive ? (
          <div
            className="flex items-center gap-1 rounded-[20px] px-2 py-0.5 text-[10px] font-semibold"
            style={{ background: 'rgba(240,90,90,0.1)', color: 'var(--red)' }}
          >
            <span className="w-1 h-1 rounded-full animate-blink" style={{ background: 'var(--red)' }} />
            Live
          </div>
        ) : (
          <span className="text-[10px] capitalize" style={{ color: 'var(--dm)' }}>
            {room.status}
          </span>
        )}
      </div>

      <div className="font-syne text-[14px] font-bold mb-1" style={{ color: 'var(--tx)' }}>
        {room.match_name}
      </div>

      {/* Match date */}
      {room.match_date && (
        <div className="text-[11px] mb-1.5" style={{ color: 'var(--gold)' }}>
          {formatMatchDate(room.match_date)}
        </div>
      )}

      {/* Venue */}
      {room.venue && (
        <div className="text-[10px] mb-2" style={{ color: 'var(--dm)' }}>
          {room.venue}
        </div>
      )}

      {progressText && (
        <div
          className="text-[12px] rounded-md px-2.5 py-1 inline-block mb-2"
          style={{ background: 'var(--s2)', color: 'var(--tx)' }}
        >
          {progressText}
        </div>
      )}

      <div className="flex items-center justify-between mt-2">
        {room.fan_count > 0 ? (
          <span className="text-[11px]" style={{ color: 'var(--mu)' }}>
            {room.fan_count.toLocaleString()} fans
          </span>
        ) : (
          <span />
        )}
        <span
          className="text-[11px] font-semibold"
          style={{ color: 'var(--gold)' }}
        >
          {isLive ? 'Join →' : 'View'}
        </span>
      </div>
    </Link>
  );
}
