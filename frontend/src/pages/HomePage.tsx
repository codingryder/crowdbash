import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import type { Room } from '../types';

interface LeagueInfo {
  sport: string;
  league: string;
  total_rooms: number;
  live_rooms: number;
  upcoming_rooms: number;
}

// League display config
const LEAGUE_ICONS: Record<string, string> = {
  'Indian Premier League 2026': '\uD83C\uDDEE\uD83C\uDDF3',
  'Pakistan Super League 2026': '\uD83C\uDDF5\uD83C\uDDF0',
  'Big Bash League': '\uD83C\uDDE6\uD83C\uDDFA',
  'Caribbean Premier League': '\uD83C\uDDF9\uD83C\uDDF9',
  'SA20': '\uD83C\uDDFF\uD83C\uDDE6',
  'The Hundred': '\uD83C\uDDEC\uD83C\uDDE7',
  'Lanka Premier League': '\uD83C\uDDF1\uD83C\uDDF0',
  'Bangladesh Premier League': '\uD83C\uDDE7\uD83C\uDDE9',
  'Premier League': '\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62\uDB40\uDC65\uDB40\uDC6E\uDB40\uDC67\uDB40\uDC7F',
  'La Liga': '\uD83C\uDDEA\uD83C\uDDF8',
  'Serie A': '\uD83C\uDDEE\uD83C\uDDF9',
  'Bundesliga': '\uD83C\uDDE9\uD83C\uDDEA',
  'Ligue 1': '\uD83C\uDDEB\uD83C\uDDF7',
  'Champions League': '\uD83C\uDFC6',
  'Copa Libertadores': '\uD83C\uDDe7\uD83C\uDDF7',
  'World Cup': '\uD83C\uDF0D',
};

type FilterTab = 'all' | 'cricket' | 'football';

export function HomePage() {
  const [leagues, setLeagues] = useState<LeagueInfo[]>([]);
  const [popularRooms, setPopularRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>('all');

  useEffect(() => {
    async function fetchData() {
      try {
        const [leaguesRes, roomsRes] = await Promise.all([
          api.get('/api/rooms/leagues'),
          api.get('/api/rooms/?status=live'),
        ]);
        if (Array.isArray(leaguesRes.data)) setLeagues(leaguesRes.data);
        if (Array.isArray(roomsRes.data)) setPopularRooms(roomsRes.data.slice(0, 6));
      } catch {
        // Backend not available
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const filteredLeagues = filter === 'all'
    ? leagues
    : leagues.filter((l) => l.sport === filter);

  const cricketLeagues = filteredLeagues.filter((l) => l.sport === 'cricket');
  const footballLeagues = filteredLeagues.filter((l) => l.sport === 'football');

  return (
    <main style={{ padding: '28px 32px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Hero */}
      <div className="mb-8">
        <div className="font-syne text-[28px] font-extrabold mb-2" style={{ color: 'var(--tx)' }}>
          Your live sports arena
        </div>
        <div className="text-[14px] leading-relaxed" style={{ color: 'var(--mu)', maxWidth: 500 }}>
          Watch live matches, chat with fans, play the Weightage Game, and compete on leaderboards.
          Pick a league to get started.
        </div>
      </div>

      {/* Sport filter tabs */}
      <div className="flex gap-2 mb-8">
        {([
          { key: 'all', label: 'All Sports' },
          { key: 'cricket', label: '\uD83C\uDFCF Cricket' },
          { key: 'football', label: '\u26BD Football' },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className="rounded-lg px-4 py-2 text-[13px] font-semibold cursor-pointer border-none transition-all"
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

      {/* Live now — popular rooms */}
      {popularRooms.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <span
              className="w-2 h-2 rounded-full animate-blink"
              style={{ background: 'var(--red)' }}
            />
            <span className="font-syne text-[15px] font-bold" style={{ color: 'var(--red)' }}>
              Live now
            </span>
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
            {popularRooms.map((room) => (
              <LiveRoomCard key={room.id} room={room} />
            ))}
          </div>
        </section>
      )}

      {loading && (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="rounded-[14px] p-5 animate-pulse" style={{ background: 'var(--s1)', border: '0.5px solid var(--b1)' }}>
              <div className="h-4 rounded w-1/3 mb-3" style={{ background: 'var(--s2)' }} />
              <div className="h-6 rounded w-2/3" style={{ background: 'var(--s2)' }} />
            </div>
          ))}
        </div>
      )}

      {/* Cricket Leagues */}
      {!loading && cricketLeagues.length > 0 && (filter === 'all' || filter === 'cricket') && (
        <section className="mb-10">
          <div className="font-syne text-[16px] font-bold mb-4" style={{ color: 'var(--tx)' }}>
            \uD83C\uDFCF Cricket
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
            {cricketLeagues.map((league) => (
              <LeagueCard key={league.league} league={league} />
            ))}
          </div>
        </section>
      )}

      {/* Football Leagues */}
      {!loading && footballLeagues.length > 0 && (filter === 'all' || filter === 'football') && (
        <section className="mb-10">
          <div className="font-syne text-[16px] font-bold mb-4" style={{ color: 'var(--tx)' }}>
            \u26BD Football
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
            {footballLeagues.map((league) => (
              <LeagueCard key={league.league} league={league} />
            ))}
          </div>
        </section>
      )}

      {/* Empty */}
      {!loading && leagues.length === 0 && (
        <div className="text-center py-16">
          <div className="font-syne text-lg mb-2" style={{ color: 'var(--mu)' }}>
            No leagues available yet
          </div>
          <div className="text-sm" style={{ color: 'var(--dm)' }}>
            Rooms are created automatically when live matches start.
          </div>
        </div>
      )}
    </main>
  );
}

function LeagueCard({ league }: { league: LeagueInfo }) {
  const icon = LEAGUE_ICONS[league.league] || (league.sport === 'football' ? '\u26BD' : '\uD83C\uDFCF');
  const hasLive = league.live_rooms > 0;

  return (
    <Link
      to={`/league/${encodeURIComponent(league.league)}`}
      className="block rounded-[14px] p-5 cursor-pointer transition-all no-underline"
      style={{ background: 'var(--s1)', border: '0.5px solid var(--b1)' }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(244,185,64,0.4)')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--b1)')}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-2xl">{icon}</span>
        {hasLive && (
          <div
            className="flex items-center gap-1 rounded-[20px] px-2 py-0.5 text-[10px] font-semibold"
            style={{ background: 'rgba(240,90,90,0.1)', color: 'var(--red)' }}
          >
            <span className="w-1 h-1 rounded-full animate-blink" style={{ background: 'var(--red)' }} />
            {league.live_rooms} Live
          </div>
        )}
      </div>

      <div className="font-syne text-[14px] font-bold mb-1" style={{ color: 'var(--tx)' }}>
        {league.league}
      </div>

      <div className="flex gap-3 mt-2">
        {league.live_rooms > 0 && (
          <span className="text-[11px]" style={{ color: 'var(--green)' }}>
            {league.live_rooms} live
          </span>
        )}
        {league.upcoming_rooms > 0 && (
          <span className="text-[11px]" style={{ color: 'var(--mu)' }}>
            {league.upcoming_rooms} upcoming
          </span>
        )}
        <span className="text-[11px]" style={{ color: 'var(--dm)' }}>
          {league.total_rooms} total
        </span>
      </div>
    </Link>
  );
}

function LiveRoomCard({ room }: { room: Room }) {
  const sportIcon = room.sport === 'football' ? '\u26BD' : '\uD83C\uDFCF';

  return (
    <Link
      to={`/room/${room.id}`}
      className="block rounded-[14px] p-4 no-underline transition-all"
      style={{ background: 'var(--s1)', border: '0.5px solid rgba(240,90,90,0.2)' }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(244,185,64,0.4)')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(240,90,90,0.2)')}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px]" style={{ color: 'var(--mu)' }}>
          {sportIcon} {room.league || room.match_format}
        </span>
        <div
          className="flex items-center gap-1 rounded-[20px] px-2 py-0.5 text-[10px] font-semibold"
          style={{ background: 'rgba(240,90,90,0.1)', color: 'var(--red)' }}
        >
          <span className="w-1 h-1 rounded-full animate-blink" style={{ background: 'var(--red)' }} />
          Live
        </div>
      </div>
      <div className="font-syne text-[13px] font-bold" style={{ color: 'var(--tx)' }}>
        {room.match_name}
      </div>
      {room.fan_count > 0 && (
        <div className="text-[11px] mt-1" style={{ color: 'var(--mu)' }}>
          {room.fan_count.toLocaleString()} fans
        </div>
      )}
    </Link>
  );
}
