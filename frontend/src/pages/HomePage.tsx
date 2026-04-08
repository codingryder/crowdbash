import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import type { Room } from '../types';

// Sample rooms for mockup display
const SAMPLE_LIVE: Room[] = [
  { id: 'demo-1', match_id: 'm1', match_name: 'India vs Australia', match_format: 'ICC World Cup \u00b7 ODI \u00b7 MCG', venue: 'MCG', status: 'live', current_over: 48.3, fan_count: 2841 },
  { id: 'demo-2', match_id: 'm2', match_name: 'RCB vs MI', match_format: 'IPL 2025 \u00b7 T20 \u00b7 Chinnaswamy', venue: 'Chinnaswamy', status: 'live', current_over: 15.2, fan_count: 5122 },
  { id: 'demo-3', match_id: 'm3', match_name: 'England vs Pakistan', match_format: "Test \u00b7 Lord's", venue: "Lord's", status: 'upcoming', current_over: 0, fan_count: 841 },
];

const SAMPLE_UPCOMING: Room[] = [
  { id: 'demo-4', match_id: 'm4', match_name: 'SA vs NZ', match_format: 'T20I \u00b7 Johannesburg', venue: 'Johannesburg', status: 'upcoming', current_over: 0, fan_count: 0 },
  { id: 'demo-5', match_id: 'm5', match_name: 'CSK vs KKR', match_format: 'IPL \u00b7 Chepauk', venue: 'Chepauk', status: 'upcoming', current_over: 0, fan_count: 0 },
  { id: 'demo-6', match_id: 'm6', match_name: 'IND vs WI', match_format: 'ODI \u00b7 Ahmedabad', venue: 'Ahmedabad', status: 'upcoming', current_over: 0, fan_count: 0 },
];

const SCORE_SAMPLES: Record<string, string> = {
  'demo-1': 'IND 287/8 (48.3) vs AUS \u2014',
  'demo-2': 'RCB 142/4 (15.2) vs MI 167/6',
};

const STATS_SAMPLES: Record<string, { fans: number; games: number }> = {
  'demo-1': { fans: 2841, games: 147 },
  'demo-2': { fans: 5122, games: 390 },
};

const TIME_SAMPLES: Record<string, string> = {
  'demo-3': 'In 2h 15m',
  'demo-4': 'Tomorrow',
  'demo-5': 'Sat 7:30 PM',
  'demo-6': 'Sun 1:30 PM',
};

export function HomePage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [_loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRooms() {
      try {
        const { data } = await api.get('/api/rooms/');
        setRooms(data);
      } catch {
        // Backend not running, use sample data
      } finally {
        setLoading(false);
      }
    }
    fetchRooms();
  }, []);

  const liveRooms = rooms.length > 0
    ? rooms.filter((r) => r.status === 'live')
    : SAMPLE_LIVE.filter((r) => r.status === 'live');
  const upcomingRooms = rooms.length > 0
    ? rooms.filter((r) => r.status === 'upcoming')
    : [...SAMPLE_LIVE.filter((r) => r.status === 'upcoming'), ...SAMPLE_UPCOMING];

  return (
    <main style={{ padding: '28px 32px' }}>
      <div className="font-syne text-[22px] font-extrabold mb-1.5">Live fan rooms</div>
      <div className="text-[13px] mb-6" style={{ color: 'var(--mu)' }}>
        Join a room, play the weightage game, and watch with your tribe.
      </div>

      {/* Live section */}
      {liveRooms.length > 0 && (
        <>
          <div
            className="text-[10px] uppercase tracking-[1px] mb-3"
            style={{ color: 'var(--mu)' }}
          >
            Live now &mdash; {liveRooms.length} rooms
          </div>
          <div
            className="grid gap-3.5 mb-8"
            style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}
          >
            {liveRooms.map((room) => (
              <RoomCard key={room.id} room={room} />
            ))}
          </div>
        </>
      )}

      {/* Upcoming section */}
      {upcomingRooms.length > 0 && (
        <>
          <div
            className="text-[10px] uppercase tracking-[1px] mb-3"
            style={{ color: 'var(--mu)' }}
          >
            Scheduled &mdash; coming up
          </div>
          <div
            className="grid gap-3.5"
            style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}
          >
            {upcomingRooms.map((room) => (
              <RoomCard key={room.id} room={room} isUpcoming />
            ))}
          </div>
        </>
      )}
    </main>
  );
}

function RoomCard({ room, isUpcoming }: { room: Room; isUpcoming?: boolean }) {
  const scoreText = SCORE_SAMPLES[room.id];
  const stats = STATS_SAMPLES[room.id];
  const timeText = TIME_SAMPLES[room.id];

  return (
    <Link
      to={`/room/${room.id}`}
      className="block rounded-[14px] cursor-pointer transition-colors no-underline"
      style={{
        background: 'var(--s1)',
        border: '0.5px solid var(--b1)',
        padding: 18,
        borderColor: 'var(--b1)',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(244,185,64,0.4)')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--b1)')}
    >
      {/* Top row */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="font-syne text-[15px] font-bold" style={{ color: 'var(--tx)' }}>
            {room.match_name}
          </div>
          <div className="text-[11px] mt-0.5" style={{ color: 'var(--mu)' }}>
            {room.match_format}
          </div>
        </div>
        {room.status === 'live' ? (
          <div
            className="flex items-center gap-1 rounded-[20px] px-2.5 py-0.5 text-[10px] font-semibold whitespace-nowrap"
            style={{ background: 'rgba(240,90,90,0.1)', color: 'var(--red)' }}
          >
            <span
              className="w-1 h-1 rounded-full animate-blink"
              style={{ background: 'var(--red)' }}
            />
            Live
          </div>
        ) : (
          <span className="text-[11px]" style={{ color: 'var(--mu)' }}>
            {timeText || 'Upcoming'}
          </span>
        )}
      </div>

      {/* Score */}
      {scoreText && (
        <div
          className="font-syne text-[13px] rounded-lg px-3 py-2 mb-3"
          style={{ background: 'var(--s2)', color: 'var(--tx)' }}
        >
          {scoreText}
        </div>
      )}
      {isUpcoming && !scoreText && (
        <div
          className="font-syne text-[13px] rounded-lg px-3 py-2 mb-3"
          style={{ background: 'var(--s2)', color: 'var(--mu)' }}
        >
          Match starts soon
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="flex gap-4 mb-3.5">
          <div className="text-xs" style={{ color: 'var(--mu)' }}>
            Fans <span style={{ color: 'var(--tx)', fontWeight: 500 }}>{stats.fans.toLocaleString()}</span>
          </div>
          <div className="text-xs" style={{ color: 'var(--mu)' }}>
            Games <span style={{ color: 'var(--tx)', fontWeight: 500 }}>{stats.games}</span>
          </div>
          {room.id === 'demo-1' && (
            <div className="text-xs" style={{ color: 'var(--mu)' }}>Quiz active</div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5 flex-wrap">
          {room.status === 'live' ? (
            <>
              <span
                className="rounded-[20px] px-2.5 py-0.5 text-[10px]"
                style={{ background: 'var(--s2)', border: '0.5px solid var(--b1)', color: 'var(--mu)' }}
              >
                Game on
              </span>
              <span
                className="rounded-[20px] px-2.5 py-0.5 text-[10px]"
                style={{ background: 'var(--s2)', border: '0.5px solid var(--b1)', color: 'var(--mu)' }}
              >
                Quiz
              </span>
              <span
                className="rounded-[20px] px-2.5 py-0.5 text-[10px]"
                style={{ background: 'var(--s2)', border: '0.5px solid var(--b1)', color: 'var(--mu)' }}
              >
                1v1
              </span>
            </>
          ) : (
            <span
              className="rounded-[20px] px-2.5 py-0.5 text-[10px]"
              style={{ background: 'var(--s2)', border: '0.5px solid var(--b1)', color: 'var(--mu)' }}
            >
              {isUpcoming ? 'Set reminder' : 'Upcoming'}
            </span>
          )}
        </div>
        <button
          className="rounded-lg px-4 py-1.5 text-xs font-bold cursor-pointer font-syne border-none whitespace-nowrap"
          style={
            room.status === 'live'
              ? { background: 'var(--gold)', color: '#09090F' }
              : { background: 'var(--s2)', color: 'var(--tx)', border: '0.5px solid var(--b2)' }
          }
        >
          {room.status === 'live' ? 'Join \u2192' : 'Remind'}
        </button>
      </div>
    </Link>
  );
}
