import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import type { Room } from '../types';

// Sample rooms shown when backend has no data
const SAMPLE_ROOMS: Room[] = [
  { id: 'demo-1', match_id: 'm1', match_name: 'India vs Australia', match_format: 'ICC World Cup \u00b7 ODI \u00b7 MCG', venue: 'MCG', status: 'live', current_over: 48.3, fan_count: 2841, sport: 'cricket', league: 'ICC World Cup', match_progress: { over: 48.3 } },
  { id: 'demo-f1', match_id: 'f1', match_name: 'Arsenal vs Chelsea', match_format: 'EPL \u00b7 Emirates', venue: 'Emirates Stadium', status: 'live', current_over: 0, fan_count: 8340, sport: 'football', league: 'Premier League', match_progress: { half: 2, minute: 67 } },
  { id: 'demo-3', match_id: 'm3', match_name: 'England vs Pakistan', match_format: "Test \u00b7 Lord's", venue: "Lord's", status: 'upcoming', current_over: 0, fan_count: 841, sport: 'cricket', league: 'Test Series', match_progress: {} },
  { id: 'demo-f3', match_id: 'f3', match_name: 'Man City vs Liverpool', match_format: 'EPL \u00b7 Etihad', venue: 'Etihad Stadium', status: 'upcoming', current_over: 0, fan_count: 0, sport: 'football', league: 'Premier League', match_progress: {} },
];

type FilterTab = 'all' | 'cricket' | 'football';

export function HomePage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>('all');

  useEffect(() => {
    async function fetchRooms() {
      try {
        const { data } = await api.get('/api/rooms/');
        if (Array.isArray(data) && data.length > 0) {
          setRooms(data);
        }
      } catch {
        // Backend not available — sample data shown
      } finally {
        setLoading(false);
      }
    }
    fetchRooms();
  }, []);

  // Use real rooms if available, else sample
  const allRooms = rooms.length > 0 ? rooms : SAMPLE_ROOMS;
  const filteredRooms = filter === 'all'
    ? allRooms
    : allRooms.filter((r) => r.sport === filter);

  const liveRooms = filteredRooms.filter((r) => r.status === 'live');
  const upcomingRooms = filteredRooms.filter((r) => r.status === 'upcoming');
  const completedRooms = filteredRooms.filter((r) => r.status === 'completed');

  return (
    <main style={{ padding: '28px 32px' }}>
      <div className="font-syne text-[22px] font-extrabold mb-1.5">Live fan rooms</div>
      <div className="text-[13px] mb-5" style={{ color: 'var(--mu)' }}>
        Join a room, play the weightage game, and watch with your tribe.
      </div>

      {/* Sport filter tabs */}
      <div className="flex gap-2 mb-6">
        {([
          { key: 'all', label: 'All Sports' },
          { key: 'cricket', label: '\uD83C\uDFCF Cricket' },
          { key: 'football', label: '\u26BD Football' },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className="rounded-lg px-4 py-1.5 text-xs font-semibold cursor-pointer border-none transition-all"
            style={
              filter === tab.key
                ? { background: 'var(--gold)', color: '#09090F' }
                : { background: 'var(--s1)', border: '0.5px solid var(--b1)', color: 'var(--mu)' }
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="grid gap-3.5 mb-8" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-[14px] p-[18px] animate-pulse" style={{ background: 'var(--s1)', border: '0.5px solid var(--b1)' }}>
              <div className="h-4 rounded w-1/3 mb-3" style={{ background: 'var(--s2)' }} />
              <div className="h-6 rounded w-2/3 mb-2" style={{ background: 'var(--s2)' }} />
              <div className="h-3 rounded w-1/2" style={{ background: 'var(--s2)' }} />
            </div>
          ))}
        </div>
      )}

      {/* Live section */}
      {!loading && liveRooms.length > 0 && (
        <>
          <div className="text-[10px] uppercase tracking-[1px] mb-3" style={{ color: 'var(--mu)' }}>
            Live now &mdash; {liveRooms.length} rooms
          </div>
          <div className="grid gap-3.5 mb-8" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
            {liveRooms.map((room) => (
              <RoomCard key={room.id} room={room} />
            ))}
          </div>
        </>
      )}

      {/* Upcoming section */}
      {!loading && upcomingRooms.length > 0 && (
        <>
          <div className="text-[10px] uppercase tracking-[1px] mb-3" style={{ color: 'var(--mu)' }}>
            Scheduled &mdash; coming up
          </div>
          <div className="grid gap-3.5 mb-8" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
            {upcomingRooms.map((room) => (
              <RoomCard key={room.id} room={room} isUpcoming />
            ))}
          </div>
        </>
      )}

      {/* Completed section */}
      {!loading && completedRooms.length > 0 && (
        <>
          <div className="text-[10px] uppercase tracking-[1px] mb-3" style={{ color: 'var(--mu)' }}>
            Completed
          </div>
          <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
            {completedRooms.map((room) => (
              <RoomCard key={room.id} room={room} />
            ))}
          </div>
        </>
      )}

      {/* Empty state */}
      {!loading && filteredRooms.length === 0 && (
        <div className="text-center py-16">
          <div className="font-syne text-lg mb-2" style={{ color: 'var(--mu)' }}>
            No {filter !== 'all' ? filter : ''} rooms available
          </div>
          <div className="text-sm" style={{ color: 'var(--dm)' }}>
            Rooms are created automatically when live matches start.
          </div>
        </div>
      )}
    </main>
  );
}

function RoomCard({ room, isUpcoming }: { room: Room; isUpcoming?: boolean }) {
  const sportIcon = room.sport === 'football' ? '\u26BD' : '\uD83C\uDFCF';

  // Format progress display
  let progressText = '';
  if (room.sport === 'cricket' && room.current_over > 0) {
    progressText = `Over ${room.current_over}`;
  } else if (room.sport === 'football') {
    const mp = room.match_progress || {};
    const minute = mp.minute as number;
    if (minute) {
      progressText = `${minute}\u2019 ${(mp.half as number) === 1 ? '1H' : '2H'}`;
    }
  }

  return (
    <Link
      to={`/room/${room.id}`}
      className="block rounded-[14px] cursor-pointer transition-colors no-underline"
      style={{ background: 'var(--s1)', border: '0.5px solid var(--b1)', padding: 18 }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(244,185,64,0.4)')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--b1)')}
    >
      {/* Top row */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="font-syne text-[15px] font-bold" style={{ color: 'var(--tx)' }}>
            {sportIcon} {room.match_name}
          </div>
          <div className="text-[11px] mt-0.5" style={{ color: 'var(--mu)' }}>
            {room.league ? `${room.league} \u00b7 ` : ''}{room.match_format || room.venue}
          </div>
        </div>
        {room.status === 'live' ? (
          <div
            className="flex items-center gap-1 rounded-[20px] px-2.5 py-0.5 text-[10px] font-semibold whitespace-nowrap"
            style={{ background: 'rgba(240,90,90,0.1)', color: 'var(--red)' }}
          >
            <span className="w-1 h-1 rounded-full animate-blink" style={{ background: 'var(--red)' }} />
            Live
          </div>
        ) : (
          <span className="text-[11px]" style={{ color: 'var(--mu)' }}>
            {isUpcoming ? 'Upcoming' : room.status}
          </span>
        )}
      </div>

      {/* Progress */}
      {progressText && (
        <div className="font-syne text-[13px] rounded-lg px-3 py-2 mb-3" style={{ background: 'var(--s2)', color: 'var(--tx)' }}>
          {progressText}
        </div>
      )}

      {/* Stats */}
      <div className="flex gap-4 mb-3.5">
        {room.fan_count > 0 && (
          <div className="text-xs" style={{ color: 'var(--mu)' }}>
            Fans <span style={{ color: 'var(--tx)', fontWeight: 500 }}>{room.fan_count.toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5 flex-wrap">
          <span className="rounded-[20px] px-2.5 py-0.5 text-[10px]"
            style={{ background: 'var(--s2)', border: '0.5px solid var(--b1)', color: 'var(--mu)' }}>
            {room.sport === 'football' ? 'Football' : 'Cricket'}
          </span>
          {room.status === 'live' && (
            <span className="rounded-[20px] px-2.5 py-0.5 text-[10px]"
              style={{ background: 'var(--s2)', border: '0.5px solid var(--b1)', color: 'var(--mu)' }}>
              Game on
            </span>
          )}
        </div>
        <button
          className="rounded-lg px-4 py-1.5 text-xs font-bold cursor-pointer font-syne border-none whitespace-nowrap"
          style={room.status === 'live' ? { background: 'var(--gold)', color: '#09090F' } : { background: 'var(--s2)', color: 'var(--tx)', border: '0.5px solid var(--b2)' }}
        >
          {room.status === 'live' ? 'Join \u2192' : 'Remind'}
        </button>
      </div>
    </Link>
  );
}
