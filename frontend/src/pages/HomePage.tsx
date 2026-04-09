import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import type { Room } from '../types';

// Sample rooms for mockup display
const SAMPLE_ROOMS: Room[] = [
  // Cricket
  { id: 'demo-1', match_id: 'm1', match_name: 'India vs Australia', match_format: 'ICC World Cup \u00b7 ODI \u00b7 MCG', venue: 'MCG', status: 'live', current_over: 48.3, fan_count: 2841, sport: 'cricket', league: 'ICC World Cup', match_progress: { over: 48.3 } },
  { id: 'demo-2', match_id: 'm2', match_name: 'RCB vs MI', match_format: 'IPL 2025 \u00b7 T20 \u00b7 Chinnaswamy', venue: 'Chinnaswamy', status: 'live', current_over: 15.2, fan_count: 5122, sport: 'cricket', league: 'IPL', match_progress: { over: 15.2 } },
  // Football
  { id: 'demo-f1', match_id: 'f1', match_name: 'Arsenal vs Chelsea', match_format: 'EPL \u00b7 Emirates', venue: 'Emirates Stadium', status: 'live', current_over: 0, fan_count: 8340, sport: 'football', league: 'Premier League', match_progress: { half: 2, minute: 67 } },
  { id: 'demo-f2', match_id: 'f2', match_name: 'Real Madrid vs Barcelona', match_format: 'La Liga \u00b7 Bernab\u00e9u', venue: 'Santiago Bernab\u00e9u', status: 'live', current_over: 0, fan_count: 12450, sport: 'football', league: 'La Liga', match_progress: { half: 1, minute: 34 } },
  // Upcoming cricket
  { id: 'demo-3', match_id: 'm3', match_name: 'England vs Pakistan', match_format: "Test \u00b7 Lord's", venue: "Lord's", status: 'upcoming', current_over: 0, fan_count: 841, sport: 'cricket', league: 'Test Series', match_progress: {} },
  { id: 'demo-4', match_id: 'm4', match_name: 'CSK vs KKR', match_format: 'IPL \u00b7 Chepauk', venue: 'Chepauk', status: 'upcoming', current_over: 0, fan_count: 0, sport: 'cricket', league: 'IPL', match_progress: {} },
  // Upcoming football
  { id: 'demo-f3', match_id: 'f3', match_name: 'Man City vs Liverpool', match_format: 'EPL \u00b7 Etihad', venue: 'Etihad Stadium', status: 'upcoming', current_over: 0, fan_count: 0, sport: 'football', league: 'Premier League', match_progress: {} },
  { id: 'demo-f4', match_id: 'f4', match_name: 'Bayern vs Dortmund', match_format: 'Bundesliga \u00b7 Allianz Arena', venue: 'Allianz Arena', status: 'upcoming', current_over: 0, fan_count: 0, sport: 'football', league: 'Bundesliga', match_progress: {} },
];

const SCORE_SAMPLES: Record<string, string> = {
  'demo-1': 'IND 287/8 (48.3) vs AUS \u2014',
  'demo-2': 'RCB 142/4 (15.2) vs MI 167/6',
  'demo-f1': 'Arsenal 2 - 1 Chelsea \u00b7 67\u2019',
  'demo-f2': 'Real Madrid 0 - 0 Barcelona \u00b7 34\u2019',
};

const STATS_SAMPLES: Record<string, { fans: number; games: number }> = {
  'demo-1': { fans: 2841, games: 147 },
  'demo-2': { fans: 5122, games: 390 },
  'demo-f1': { fans: 8340, games: 562 },
  'demo-f2': { fans: 12450, games: 891 },
};

const TIME_SAMPLES: Record<string, string> = {
  'demo-3': 'In 2h 15m',
  'demo-4': 'Sat 7:30 PM',
  'demo-f3': 'Tomorrow 8 PM',
  'demo-f4': 'Sun 6:30 PM',
};

type FilterTab = 'all' | 'cricket' | 'football';

export function HomePage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [_loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>('all');

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

  const allRooms = rooms.length > 0 ? rooms : SAMPLE_ROOMS;
  const filteredRooms = filter === 'all'
    ? allRooms
    : allRooms.filter((r) => r.sport === filter);

  const liveRooms = filteredRooms.filter((r) => r.status === 'live');
  const upcomingRooms = filteredRooms.filter((r) => r.status === 'upcoming');

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

      {/* Live section */}
      {liveRooms.length > 0 && (
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
      {upcomingRooms.length > 0 && (
        <>
          <div className="text-[10px] uppercase tracking-[1px] mb-3" style={{ color: 'var(--mu)' }}>
            Scheduled &mdash; coming up
          </div>
          <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
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
  const sportIcon = room.sport === 'football' ? '\u26BD' : '\uD83C\uDFCF';

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
            {room.league ? `${room.league} \u00b7 ` : ''}{room.match_format}
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
          <span className="text-[11px]" style={{ color: 'var(--mu)' }}>{timeText || 'Upcoming'}</span>
        )}
      </div>

      {/* Score */}
      {scoreText && (
        <div className="font-syne text-[13px] rounded-lg px-3 py-2 mb-3" style={{ background: 'var(--s2)', color: 'var(--tx)' }}>
          {scoreText}
        </div>
      )}
      {isUpcoming && !scoreText && (
        <div className="font-syne text-[13px] rounded-lg px-3 py-2 mb-3" style={{ background: 'var(--s2)', color: 'var(--mu)' }}>
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
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5 flex-wrap">
          <span className="rounded-[20px] px-2.5 py-0.5 text-[10px]"
            style={{ background: 'var(--s2)', border: '0.5px solid var(--b1)', color: 'var(--mu)' }}>
            {room.sport === 'football' ? 'Football' : 'Cricket'}
          </span>
          {room.status === 'live' && (
            <>
              <span className="rounded-[20px] px-2.5 py-0.5 text-[10px]"
                style={{ background: 'var(--s2)', border: '0.5px solid var(--b1)', color: 'var(--mu)' }}>
                Game on
              </span>
              <span className="rounded-[20px] px-2.5 py-0.5 text-[10px]"
                style={{ background: 'var(--s2)', border: '0.5px solid var(--b1)', color: 'var(--mu)' }}>
                Quiz
              </span>
            </>
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
