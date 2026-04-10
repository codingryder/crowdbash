import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import type { Room } from '../types';
import { formatMatchDate } from '../types';

export function HomePage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [waking, setWaking] = useState(false);

  useEffect(() => {
    async function fetchData(retryCount = 0) {
      try {
        const { data } = await api.get('/api/rooms/');
        if (Array.isArray(data)) setRooms(data);
        setWaking(false);
      } catch {
        if (retryCount < 3) {
          setWaking(true);
          await new Promise((r) => setTimeout(r, 3000));
          return fetchData(retryCount + 1);
        }
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Get upcoming matches sorted by date (soonest first), max 3 per sport
  const upcomingCricket = rooms
    .filter((r) => r.sport === 'cricket' && r.status === 'upcoming')
    .sort((a, b) => {
      const da = a.match_date ? new Date(a.match_date).getTime() : Infinity;
      const db = b.match_date ? new Date(b.match_date).getTime() : Infinity;
      return da - db;
    })
    .slice(0, 3);

  const upcomingFootball = rooms
    .filter((r) => r.sport === 'football' && r.status === 'upcoming')
    .sort((a, b) => {
      const da = a.match_date ? new Date(a.match_date).getTime() : Infinity;
      const db = b.match_date ? new Date(b.match_date).getTime() : Infinity;
      return da - db;
    })
    .slice(0, 3);

  const liveRooms = rooms.filter((r) => r.status === 'live').slice(0, 3);

  return (
    <div style={{ paddingTop: 60 }}>
      {/* ── HERO ── */}
      <section
        className="relative overflow-hidden flex items-center justify-center"
        style={{ minHeight: 'calc(100vh - 60px)', padding: '80px 24px' }}
      >
        {/* Glow background */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `
              radial-gradient(ellipse 55% 45% at 50% -5%, rgba(45,214,122,0.09) 0%, transparent 70%),
              radial-gradient(ellipse 35% 35% at 85% 65%, rgba(139,92,246,0.06) 0%, transparent 60%),
              radial-gradient(ellipse 30% 30% at 10% 80%, rgba(59,130,246,0.05) 0%, transparent 60%)
            `,
          }}
        />
        {/* Dot pattern */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
            maskImage: 'radial-gradient(ellipse 70% 70% at 50% 50%, black 0%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse 70% 70% at 50% 50%, black 0%, transparent 100%)',
          }}
        />

        <div className="relative z-10 text-center" style={{ maxWidth: 860 }}>
          {/* Eyebrow */}
          <div
            className="inline-flex items-center gap-2 rounded-full mb-9 animate-fadeup"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--b2)',
              padding: '6px 18px',
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--tx2)',
            }}
          >
            <div className="w-1.5 h-1.5 rounded-full animate-pulse-slow" style={{ background: 'var(--green)' }} />
            India's boldest sports fantasy platform
          </div>

          {/* Headline */}
          <h1
            className="font-cabinet font-black leading-none mb-7 animate-fadeup"
            style={{
              fontSize: 'clamp(50px, 8.5vw, 94px)',
              letterSpacing: '-3px',
              animationDelay: '0.1s',
            }}
          >
            <span style={{ color: 'var(--green)' }}>Your</span> team.<br />
            <span style={{ color: 'var(--green)' }}>Your</span> power.<br />
            <span style={{ color: 'var(--mu)' }}>Your</span> rules.
          </h1>

          {/* Subtitle */}
          <p
            className="mx-auto mb-11 animate-fadeup"
            style={{
              fontSize: 17,
              color: 'var(--tx2)',
              lineHeight: 1.65,
              maxWidth: 520,
              animationDelay: '0.2s',
            }}
          >
            Pick your squad across cricket and football. Assign power to every player.
            Reshuffle live — the only fantasy game where strategy never stops.
          </p>

          {/* CTA Buttons */}
          <div className="flex items-center justify-center gap-3 animate-fadeup" style={{ animationDelay: '0.3s' }}>
            <Link
              to={upcomingCricket[0] ? `/room/${upcomingCricket[0].id}` : '#'}
              className="font-cabinet font-extrabold no-underline transition-all"
              style={{
                background: 'var(--green)',
                color: '#071a0e',
                border: 'none',
                borderRadius: 11,
                padding: '15px 36px',
                fontSize: 16,
              }}
            >
              Browse live games
            </Link>
            <Link
              to="/league/Indian%20Premier%20League%202026"
              className="font-cabinet font-semibold no-underline transition-all"
              style={{
                background: 'transparent',
                color: 'var(--tx2)',
                border: '1px solid var(--b2)',
                borderRadius: 11,
                padding: '15px 28px',
                fontSize: 15,
              }}
            >
              View all matches
            </Link>
          </div>

          {/* Sports strip */}
          <div
            className="flex items-center justify-center gap-3 mt-14 pt-10 animate-fadeup"
            style={{ borderTop: '1px solid var(--b1)', animationDelay: '0.45s' }}
          >
            <div
              className="flex items-center gap-2 rounded-full"
              style={{
                background: 'rgba(45,214,122,0.06)',
                border: '1px solid rgba(45,214,122,0.3)',
                padding: '8px 18px',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--green)',
              }}
            >
              🏏 Cricket
            </div>
            <div
              className="flex items-center gap-2 rounded-full"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--b1)',
                padding: '8px 18px',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--tx2)',
              }}
            >
              ⚽ Football <span className="text-[10px]" style={{ color: 'var(--mu)' }}>· Live</span>
            </div>
          </div>

          {/* Stats */}
          <div
            className="flex items-center justify-center gap-0 mt-6 animate-fadeup"
            style={{ animationDelay: '0.5s' }}
          >
            {[
              { num: '14K+', label: 'Active players' },
              { num: '480+', label: 'Rooms today' },
              { num: '2', label: 'Sports live' },
              { num: '₹9', label: 'Entry from' },
            ].map((s, i) => (
              <div key={s.label} className="flex items-center">
                {i > 0 && <div className="mx-6" style={{ width: 1, height: 36, background: 'var(--b1)' }} />}
                <div className="text-center">
                  <div className="font-cabinet text-[28px] font-black">{s.num}</div>
                  <div className="text-[11px]" style={{ color: 'var(--mu)' }}>{s.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <div style={{ borderTop: '1px solid var(--b1)' }}>
        <section className="mx-auto px-4 md:px-9 py-20" style={{ maxWidth: 1080 }}>
          <div className="font-cabinet text-[11px] font-bold tracking-[2.5px] mb-3" style={{ color: 'var(--green)' }}>
            HOW IT WORKS
          </div>
          <h2 className="font-cabinet font-black mb-3" style={{ fontSize: 'clamp(30px, 4.5vw, 50px)', letterSpacing: '-1.5px', lineHeight: 1.08 }}>
            Four steps.<br />Infinite strategy.
          </h2>
          <p className="text-[15px] mb-14" style={{ color: 'var(--tx2)', lineHeight: 1.7, maxWidth: 460 }}>
            Unlike any fantasy game you've played before — strategy runs live, not just at kickoff.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {[
              { n: '01', icon: '🏟️', title: 'Pick a match', desc: 'Cricket or football — join a live room or create your own with custom stakes.' },
              { n: '02', icon: '🎯', title: 'Build your squad', desc: 'Select 11 players on an interactive field. Position them where you want.' },
              { n: '03', icon: '⚡', title: 'Assign power', desc: 'Distribute 33 power across your squad via sliders. Max 6x, min 1x per player.' },
              { n: '04', icon: '🔄', title: 'Reshuffle live', desc: 'Every 5 overs a window opens. Reshuffle power before opponents see your move.' },
            ].map((c) => (
              <div
                key={c.n}
                className="rounded-card transition-all hover:-translate-y-1"
                style={{ background: 'var(--surface)', border: '1px solid var(--b1)', padding: '26px 22px' }}
              >
                <div className="font-cabinet text-[48px] font-black leading-none mb-4" style={{ color: 'var(--faint)', letterSpacing: '-2px' }}>
                  {c.n}
                </div>
                <div className="text-[26px] mb-3">{c.icon}</div>
                <div className="font-cabinet text-[16px] font-extrabold mb-2">{c.title}</div>
                <div className="text-[13px] leading-[1.6]" style={{ color: 'var(--tx2)' }}>{c.desc}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ── UPCOMING GAMES ── */}
      <div style={{ borderTop: '1px solid var(--b1)', background: 'var(--bg2)' }}>
        <section className="mx-auto px-4 md:px-9 py-20" style={{ maxWidth: 1080 }}>
          {loading && waking && (
            <div className="text-center mb-8 py-4 rounded-card" style={{ background: 'rgba(45,214,122,0.05)', border: '1px solid rgba(45,214,122,0.2)' }}>
              <div className="text-[13px] font-medium" style={{ color: 'var(--green)' }}>⏳ Waking up server...</div>
              <div className="text-[11px] mt-1" style={{ color: 'var(--mu)' }}>First load takes a few seconds</div>
            </div>
          )}

          {/* Live games */}
          {liveRooms.length > 0 && (
            <div className="mb-14">
              <div className="font-cabinet text-[11px] font-bold tracking-[2px] mb-3.5 flex items-center gap-2" style={{ color: 'var(--red)' }}>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse-slow" style={{ background: 'var(--red)' }} />
                LIVE NOW
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {liveRooms.map((room) => (
                  <GameCard key={room.id} room={room} />
                ))}
              </div>
            </div>
          )}

          {/* Cricket upcoming */}
          {upcomingCricket.length > 0 && (
            <div className="mb-14">
              <div className="flex items-center justify-between mb-3.5">
                <div className="font-cabinet text-[11px] font-bold tracking-[2px]" style={{ color: 'var(--mu)' }}>
                  🏏 UPCOMING CRICKET
                </div>
                <Link to="/league/Indian%20Premier%20League%202026" className="text-[12px] font-semibold no-underline" style={{ color: 'var(--green)' }}>
                  View all →
                </Link>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {upcomingCricket.map((room) => (
                  <GameCard key={room.id} room={room} />
                ))}
              </div>
            </div>
          )}

          {/* Football upcoming */}
          {upcomingFootball.length > 0 && (
            <div className="mb-14">
              <div className="flex items-center justify-between mb-3.5">
                <div className="font-cabinet text-[11px] font-bold tracking-[2px]" style={{ color: 'var(--mu)' }}>
                  ⚽ UPCOMING FOOTBALL
                </div>
                <Link to="/league/Premier%20League" className="text-[12px] font-semibold no-underline" style={{ color: 'var(--green)' }}>
                  View all →
                </Link>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {upcomingFootball.map((room) => (
                  <GameCard key={room.id} room={room} />
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* ── CTA STRIP ── */}
      <div
        className="text-center"
        style={{ background: 'var(--surface)', borderTop: '1px solid var(--b1)', borderBottom: '1px solid var(--b1)', padding: '80px 24px' }}
      >
        <h2 className="font-cabinet font-black mb-3.5" style={{ fontSize: 'clamp(32px, 5vw, 56px)', letterSpacing: '-1.5px' }}>
          Ready to play smarter?
        </h2>
        <p className="text-[16px] mb-9" style={{ color: 'var(--tx2)' }}>
          Join 14,000+ players already on Crowdbash across cricket and football.
        </p>
        <Link
          to={upcomingCricket[0] ? `/room/${upcomingCricket[0].id}` : '#'}
          className="inline-block font-cabinet font-extrabold no-underline transition-all hover:-translate-y-0.5"
          style={{ background: 'var(--green)', color: '#071a0e', borderRadius: 11, padding: '15px 36px', fontSize: 16 }}
        >
          Find a live game →
        </Link>
      </div>
    </div>
  );
}

// ── Game Card Component ──

function GameCard({ room }: { room: Room }) {
  const parts = room.match_name.split(' vs ');
  const team1 = parts[0]?.trim() || 'TBD';
  const team2 = parts[1]?.trim() || 'TBD';
  const abbr1 = team1.split(' ').map((w) => w[0]).join('').slice(0, 3).toUpperCase();
  const abbr2 = team2.split(' ').map((w) => w[0]).join('').slice(0, 3).toUpperCase();

  const isLive = room.status === 'live';
  const isCricket = room.sport === 'cricket';
  const sportLabel = isCricket ? `🏏 ${room.match_format || 'Cricket'}` : `⚽ ${room.match_format || 'Football'}`;

  return (
    <Link
      to={`/room/${room.id}`}
      className="block rounded-card overflow-hidden no-underline transition-all hover:-translate-y-1"
      style={{ background: 'var(--surface)', border: '1px solid var(--b1)' }}
    >
      {/* Top */}
      <div className="px-4 pt-4 pb-3" style={{ borderBottom: '1px solid var(--b1)' }}>
        {/* Status row */}
        <div className="flex items-center justify-between mb-3">
          {isLive ? (
            <div
              className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold font-cabinet tracking-wide"
              style={{ background: 'rgba(240,82,82,0.12)', color: 'var(--red)', border: '1px solid rgba(240,82,82,0.2)' }}
            >
              <span className="animate-pulse-slow">●</span> LIVE
            </div>
          ) : (
            <div className="text-[10px] font-bold font-cabinet tracking-wide" style={{ color: 'var(--amber)' }}>
              {formatMatchDate(room.match_date)}
            </div>
          )}
          <div
            className="text-[9px] font-bold font-cabinet tracking-[1.5px] px-2 py-0.5 rounded"
            style={{
              color: isCricket ? 'var(--amber)' : 'var(--blue)',
              background: isCricket ? 'rgba(245,158,11,0.08)' : 'rgba(59,130,246,0.08)',
            }}
          >
            {sportLabel}
          </div>
        </div>

        {/* Teams */}
        <div className="flex items-center justify-between">
          <div className="text-center flex-1">
            <div className="font-cabinet text-[24px] font-black" style={{ letterSpacing: '-0.5px' }}>{abbr1}</div>
            <div className="text-[11px] truncate" style={{ color: 'var(--mu)' }}>{team1}</div>
          </div>
          <div className="font-cabinet text-[10px] font-bold px-3" style={{ color: 'var(--faint)' }}>vs</div>
          <div className="text-center flex-1">
            <div className="font-cabinet text-[24px] font-black" style={{ letterSpacing: '-0.5px' }}>{abbr2}</div>
            <div className="text-[11px] truncate" style={{ color: 'var(--mu)' }}>{team2}</div>
          </div>
        </div>
      </div>

      {/* Bottom */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="text-[11px]" style={{ color: 'var(--mu)' }}>
          {room.league || room.venue || ''}
        </div>
        <div className="flex items-center gap-2">
          <span
            className="font-cabinet text-[12px] font-bold rounded-md px-2 py-0.5"
            style={{ color: 'var(--green)', background: 'rgba(45,214,122,0.08)' }}
          >
            ₹10
          </span>
          <span
            className="font-cabinet text-[12px] font-bold rounded-md px-4 py-1.5"
            style={{ background: 'var(--green)', color: '#071a0e' }}
          >
            {isLive ? 'Join' : 'Play'}
          </span>
        </div>
      </div>
    </Link>
  );
}
