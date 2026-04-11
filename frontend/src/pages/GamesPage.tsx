import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../lib/api';
import type { Room } from '../types';
import { formatMatchDate } from '../types';
import { ScorecardModal } from '../components/room/ScorecardModal';

interface LiveMatch {
  match_id: string;
  match_name: string;
  sport: 'cricket' | 'football';
  league: string;
  match_format: string;
  venue: string;
  match_date: string;
  status: string; // 'live' | 'upcoming'
  team1: { name: string; score: string };
  team2: { name: string; score: string };
  match_status_text: string;
}

type Tab = 'matches' | 'rooms';

export function GamesPage() {
  const [searchParams] = useSearchParams();
  const sport = searchParams.get('sport') || 'cricket';
  const [tab, setTab] = useState<Tab>('matches');

  // Live Matches state
  const [liveMatches, setLiveMatches] = useState<LiveMatch[]>([]);
  const [upcomingMatches, setUpcomingMatches] = useState<LiveMatch[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(true);

  // Live Rooms state (admin-created)
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);

  // Scorecard modal
  const [selectedMatch, setSelectedMatch] = useState<LiveMatch | null>(null);

  // Fetch live matches from sport APIs
  useEffect(() => {
    async function fetchMatches(retry = 0) {
      try {
        const { data } = await api.get('/api/matches/live');
        if (data.live) setLiveMatches(data.live);
        if (data.upcoming) setUpcomingMatches(data.upcoming);
      } catch {
        if (retry < 2) { await new Promise(r => setTimeout(r, 3000)); return fetchMatches(retry + 1); }
      } finally { setMatchesLoading(false); }
    }
    fetchMatches();
  }, []);

  // Fetch admin-created rooms
  useEffect(() => {
    async function fetchRooms(retry = 0) {
      try {
        const { data } = await api.get('/api/rooms/', { params: { admin_created: true } });
        if (Array.isArray(data)) setRooms(data);
      } catch {
        if (retry < 2) { await new Promise(r => setTimeout(r, 3000)); return fetchRooms(retry + 1); }
      } finally { setRoomsLoading(false); }
    }
    fetchRooms();
  }, []);

  // Filter by selected sport from navbar tabs
  const filteredLiveMatches = liveMatches.filter(m => m.sport === sport);
  const filteredUpcomingMatches = upcomingMatches.filter(m => m.sport === sport);
  const filteredRooms = rooms.filter(r => r.sport === sport);

  const liveRooms = filteredRooms.filter(r => r.status === 'live');
  const upcomingRooms = filteredRooms.filter(r => r.status === 'upcoming').sort((a, b) => {
    const da = a.match_date ? new Date(a.match_date).getTime() : Infinity;
    const db = b.match_date ? new Date(b.match_date).getTime() : Infinity;
    return da - db;
  });
  const allRooms = [...liveRooms, ...upcomingRooms];

  const totalLiveMatches = filteredLiveMatches.length;
  const totalLiveRooms = liveRooms.length;

  return (
    <div style={{ paddingTop: 60, minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ padding: '40px 36px 0', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <div className="flex items-end justify-between mb-5">
            <div>
              <h1 style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 38, fontWeight: 900, letterSpacing: '-1.5px', marginBottom: 4 }}>Games</h1>
              <div className="text-[13px]" style={{ color: 'var(--muted)' }}>
                {sport === 'cricket' ? '🏏 Cricket' : '⚽ Football'} — Live scores & fantasy rooms
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              {totalLiveMatches > 0 && (
                <span className="badge badge-live" style={{ fontSize: 10 }}><span className="animate-pulse-slow">●</span> {totalLiveMatches} LIVE</span>
              )}
            </div>
          </div>

          {/* Tab switcher */}
          <div className="flex gap-0">
            <button
              onClick={() => setTab('matches')}
              className="relative bg-transparent border-none cursor-pointer"
              style={{
                padding: '10px 20px',
                fontSize: 13,
                fontWeight: 700,
                fontFamily: "'Cabinet Grotesk', sans-serif",
                letterSpacing: '0.5px',
                color: tab === 'matches' ? 'var(--text)' : 'var(--muted)',
              }}
            >
              Live Matches
              {totalLiveMatches > 0 && (
                <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>{totalLiveMatches}</span>
              )}
              {tab === 'matches' && (
                <span className="absolute bottom-0 left-[10%] right-[10%] h-[2px] rounded" style={{ background: 'var(--text)' }} />
              )}
            </button>
            <button
              onClick={() => setTab('rooms')}
              className="relative bg-transparent border-none cursor-pointer"
              style={{
                padding: '10px 20px',
                fontSize: 13,
                fontWeight: 700,
                fontFamily: "'Cabinet Grotesk', sans-serif",
                letterSpacing: '0.5px',
                color: tab === 'rooms' ? 'var(--text)' : 'var(--muted)',
              }}
            >
              Live Rooms
              {totalLiveRooms > 0 && (
                <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(45,214,122,0.15)', color: '#2dd67a' }}>{totalLiveRooms}</span>
              )}
              {tab === 'rooms' && (
                <span className="absolute bottom-0 left-[10%] right-[10%] h-[2px] rounded" style={{ background: 'var(--text)' }} />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '24px 36px 60px' }}>

        {/* ── TAB 1: LIVE MATCHES ── */}
        {tab === 'matches' && (
          <>
            {matchesLoading && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="animate-pulse rounded-[14px]" style={{ background: 'var(--surface)', border: '1px solid var(--border)', height: 160 }} />
                ))}
              </div>
            )}

            {!matchesLoading && filteredLiveMatches.length > 0 && (
              <>
                <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '2px', color: 'var(--muted)', marginBottom: 14 }}>LIVE NOW</div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-10">
                  {filteredLiveMatches.map(m => (
                    <MatchCard key={m.match_id} match={m} onClick={() => setSelectedMatch(m)} />
                  ))}
                </div>
              </>
            )}

            {!matchesLoading && filteredUpcomingMatches.length > 0 && (
              <>
                <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '2px', color: 'var(--muted)', marginBottom: 14 }}>UPCOMING</div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-10">
                  {filteredUpcomingMatches.map(m => (
                    <MatchCard key={m.match_id} match={m} onClick={() => setSelectedMatch(m)} />
                  ))}
                </div>
              </>
            )}

            {!matchesLoading && filteredLiveMatches.length === 0 && filteredUpcomingMatches.length === 0 && (
              <div className="text-center py-20">
                <div className="text-3xl mb-4">📡</div>
                <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 18, fontWeight: 800, marginBottom: 4 }}>No live matches right now</div>
                <div className="text-[13px]" style={{ color: 'var(--muted)' }}>Live scores appear when matches are in progress</div>
              </div>
            )}
          </>
        )}

        {/* ── TAB 2: LIVE ROOMS ── */}
        {tab === 'rooms' && (
          <>
            {roomsLoading && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="animate-pulse rounded-[14px]" style={{ background: 'var(--surface)', border: '1px solid var(--border)', height: 180 }} />
                ))}
              </div>
            )}

            {!roomsLoading && liveRooms.length > 0 && (
              <>
                <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '2px', color: 'var(--muted)', marginBottom: 14 }}>
                  <span className="animate-pulse-slow" style={{ color: '#ef4444' }}>●</span> LIVE ROOMS
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-10">
                  {liveRooms.map(r => <RoomCard key={r.id} room={r} />)}
                </div>
              </>
            )}

            {!roomsLoading && upcomingRooms.length > 0 && (
              <>
                <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '2px', color: 'var(--muted)', marginBottom: 14 }}>UPCOMING ROOMS</div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-10">
                  {upcomingRooms.map(r => <RoomCard key={r.id} room={r} />)}
                </div>
              </>
            )}

            {!roomsLoading && allRooms.length === 0 && (
              <div className="text-center py-20">
                <div className="text-3xl mb-4">🏟️</div>
                <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 18, fontWeight: 800, marginBottom: 4 }}>No rooms available</div>
                <div className="text-[13px]" style={{ color: 'var(--muted)' }}>Fantasy game rooms will appear here when the admin creates them</div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Scorecard modal for live matches */}
      {selectedMatch && (
        <ScorecardModal
          sport={selectedMatch.sport}
          matchId={selectedMatch.match_id}
          roomName={selectedMatch.match_name}
          onClose={() => setSelectedMatch(null)}
        />
      )}
    </div>
  );
}


/* ── Match Card (for Live Matches tab) ── */
function MatchCard({ match, onClick }: { match: LiveMatch; onClick: () => void }) {
  const t1 = match.team1.name || 'TBD';
  const t2 = match.team2.name || 'TBD';
  const a1 = t1.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase();
  const a2 = t2.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase();
  const isLive = match.status === 'live';
  const isCricket = match.sport === 'cricket';

  return (
    <div
      onClick={onClick}
      className="block cursor-pointer transition-all hover:-translate-y-1"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}
    >
      <div style={{ padding: '18px 18px 14px', borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-3">
          {isLive ? (
            <span className="badge badge-live" style={{ fontSize: 10 }}><span className="animate-pulse-slow">●</span> LIVE</span>
          ) : (
            <span className="badge badge-amber" style={{ fontSize: 10 }}>{formatMatchDate(match.match_date)}</span>
          )}
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '1.5px', fontFamily: "'Cabinet Grotesk', sans-serif", padding: '3px 8px', borderRadius: 4, color: isCricket ? 'var(--amber)' : 'var(--blue)', background: isCricket ? 'rgba(245,158,11,0.08)' : 'rgba(59,130,246,0.08)' }}>
            {isCricket ? '🏏' : '⚽'} {match.match_format || match.league || ''}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-center flex-1">
            <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 24, fontWeight: 900, letterSpacing: '-0.5px' }}>{a1}</div>
            {isLive && match.team1.score ? (
              <div className="text-[11px] font-semibold" style={{ color: 'var(--green)' }}>{match.team1.score}</div>
            ) : (
              <div className="text-[11px]" style={{ color: 'var(--muted)' }}>{t1.length > 14 ? t1.slice(0, 14) + '...' : t1}</div>
            )}
          </div>
          <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 10, fontWeight: 700, color: 'var(--faint)', padding: '0 12px' }}>vs</div>
          <div className="text-center flex-1">
            <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 24, fontWeight: 900, letterSpacing: '-0.5px' }}>{a2}</div>
            {isLive && match.team2.score ? (
              <div className="text-[11px] font-semibold" style={{ color: 'var(--green)' }}>{match.team2.score}</div>
            ) : (
              <div className="text-[11px]" style={{ color: 'var(--muted)' }}>{t2.length > 14 ? t2.slice(0, 14) + '...' : t2}</div>
            )}
          </div>
        </div>

        {isLive && match.match_status_text && (
          <div className="text-center text-[10px] mt-2" style={{ color: 'var(--muted)' }}>
            {match.match_status_text.length > 50 ? match.match_status_text.slice(0, 50) + '...' : match.match_status_text}
          </div>
        )}
      </div>

      <div style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="text-[11px]" style={{ color: 'var(--muted)' }}>{match.league || ''}</div>
        <span style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 11, fontWeight: 700, color: 'var(--text)', opacity: 0.5 }}>
          {isLive ? 'View Scorecard →' : 'Details →'}
        </span>
      </div>
    </div>
  );
}


/* ── Room Card (for Live Rooms tab) ── */
function RoomCard({ room }: { room: Room }) {
  const parts = room.match_name.split(' vs ');
  const t1 = parts[0]?.trim() || 'TBD';
  const t2 = parts[1]?.trim() || 'TBD';
  const a1 = t1.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase();
  const a2 = t2.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase();
  const isLive = room.status === 'live';
  const isCricket = room.sport === 'cricket';

  return (
    <Link to={`/room/${room.id}`} className="block no-underline transition-all hover:-translate-y-1" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
      <div style={{ padding: '18px 18px 14px', borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-3">
          {isLive ? (
            <span className="badge badge-live" style={{ fontSize: 10 }}><span className="animate-pulse-slow">●</span> LIVE</span>
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
            <div className="text-[11px]" style={{ color: 'var(--muted)' }}>{t1.length > 12 ? t1.slice(0, 12) + '...' : t1}</div>
          </div>
          <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 10, fontWeight: 700, color: 'var(--faint)', padding: '0 12px' }}>vs</div>
          <div className="text-center flex-1">
            <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 24, fontWeight: 900, letterSpacing: '-0.5px' }}>{a2}</div>
            <div className="text-[11px]" style={{ color: 'var(--muted)' }}>{t2.length > 12 ? t2.slice(0, 12) + '...' : t2}</div>
          </div>
        </div>
      </div>
      <div style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="text-[11px]" style={{ color: 'var(--muted)' }}>{room.league || ''}</div>
        <div className="flex items-center gap-2">
          <span style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 12, fontWeight: 700, color: 'var(--green)', background: 'rgba(45,214,122,0.08)', borderRadius: 6, padding: '3px 9px' }}>Free</span>
          <span className="btn btn-primary" style={{ padding: '6px 16px', fontSize: 12, borderRadius: 7 }}>
            {isLive ? 'Join' : 'Play'}
          </span>
        </div>
      </div>
    </Link>
  );
}
