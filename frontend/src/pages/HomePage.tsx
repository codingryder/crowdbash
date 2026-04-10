import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import type { Room } from '../types';
import { formatMatchDate } from '../types';

export function HomePage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [_loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData(retry = 0) {
      try {
        const { data } = await api.get('/api/rooms/');
        if (Array.isArray(data)) setRooms(data);
      } catch {
        if (retry < 3) { await new Promise(r => setTimeout(r, 3000)); return fetchData(retry + 1); }
      } finally { setLoading(false); }
    }
    fetchData();
  }, []);

  const upcoming = rooms.filter(r => r.status === 'upcoming').sort((a, b) => {
    const da = a.match_date ? new Date(a.match_date).getTime() : Infinity;
    const db = b.match_date ? new Date(b.match_date).getTime() : Infinity;
    return da - db;
  });
  const live = rooms.filter(r => r.status === 'live');
  const cricketUp = upcoming.filter(r => r.sport === 'cricket').slice(0, 3);
  const footballUp = upcoming.filter(r => r.sport === 'football').slice(0, 3);

  return (
    <div style={{ paddingTop: 60 }}>
      {/* ═══ HERO ═══ */}
      <section className="relative overflow-hidden flex items-center justify-center" style={{ minHeight: 'calc(100vh - 60px)', padding: '80px 36px' }}>
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse 55% 45% at 50% -5%, rgba(45,214,122,0.09) 0%, transparent 70%), radial-gradient(ellipse 35% 35% at 85% 65%, rgba(139,92,246,0.06) 0%, transparent 60%), radial-gradient(ellipse 30% 30% at 10% 80%, rgba(59,130,246,0.05) 0%, transparent 60%)'
        }} />
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          maskImage: 'radial-gradient(ellipse 70% 70% at 50% 50%, black 0%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 70% 70% at 50% 50%, black 0%, transparent 100%)',
        }} />

        <div className="relative z-10 text-center" style={{ maxWidth: 860 }}>
          <div className="inline-flex items-center gap-2 rounded-full mb-9 animate-fadeup" style={{ background: 'var(--surface)', border: '1px solid var(--border2)', padding: '6px 18px', fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>
            <div className="w-1.5 h-1.5 rounded-full animate-pulse-slow" style={{ background: 'var(--green)' }} />
            India's boldest sports fantasy platform
          </div>

          <h1 className="animate-fadeup" style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 'clamp(50px,8.5vw,94px)', fontWeight: 900, lineHeight: 0.98, letterSpacing: '-3px', marginBottom: 28, animationDelay: '.1s' }}>
            <span style={{ color: 'var(--green)' }}>Your</span> team.<br />
            <span style={{ color: 'var(--green)' }}>Your</span> power.<br />
            <span style={{ color: 'var(--muted)' }}>Your</span> rules.
          </h1>

          <p className="mx-auto mb-11 animate-fadeup" style={{ fontSize: 17, color: 'var(--text2)', lineHeight: 1.65, maxWidth: 520, animationDelay: '.2s' }}>
            Pick your squad across cricket and football. Assign power to every player. Reshuffle live — the only fantasy game where strategy never stops.
          </p>

          <div className="flex items-center justify-center gap-3 animate-fadeup" style={{ animationDelay: '.3s' }}>
            <Link to="/games" className="no-underline transition-all hover:-translate-y-0.5" style={{ fontFamily: "'Cabinet Grotesk', sans-serif", background: 'var(--green)', color: '#071a0e', border: 'none', borderRadius: 11, padding: '15px 36px', fontSize: 16, fontWeight: 800 }}>
              Browse live games
            </Link>
            <Link to="/games" className="no-underline transition-all" style={{ fontFamily: "'Cabinet Grotesk', sans-serif", background: 'transparent', color: 'var(--text2)', border: '1px solid var(--border2)', borderRadius: 11, padding: '15px 28px', fontSize: 15, fontWeight: 600 }}>
              Create a room
            </Link>
          </div>

          <div className="flex items-center justify-center gap-3 mt-14 pt-10 animate-fadeup" style={{ borderTop: '1px solid var(--border)', animationDelay: '.45s' }}>
            <div className="flex items-center gap-2 rounded-full" style={{ background: 'rgba(45,214,122,0.06)', border: '1px solid rgba(45,214,122,0.3)', padding: '8px 18px', fontSize: 13, fontWeight: 600, color: 'var(--green)' }}>
              🏏 Cricket
            </div>
            <div className="flex items-center gap-2 rounded-full" style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '8px 18px', fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>
              ⚽ Football <span className="text-[10px]" style={{ color: 'var(--muted)' }}>· Live</span>
            </div>
            <div className="flex items-center gap-2 rounded-full" style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '8px 18px', fontSize: 13, fontWeight: 600, color: 'var(--text2)', opacity: 0.5 }}>
              🏀 Basketball <span className="text-[10px]" style={{ color: 'var(--muted)' }}>· Coming</span>
            </div>
          </div>

          <div className="flex items-center justify-center mt-6 animate-fadeup" style={{ animationDelay: '.5s' }}>
            {[{ n: '14K+', l: 'Active players' }, { n: '480+', l: 'Rooms today' }, { n: '2', l: 'Sports live' }, { n: '₹9', l: 'Entry from' }].map((s, i) => (
              <div key={s.l} className="flex items-center">
                {i > 0 && <div className="mx-8" style={{ width: 1, height: 36, background: 'var(--border)' }} />}
                <div className="text-center">
                  <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 28, fontWeight: 900 }}>{s.n}</div>
                  <div className="text-[11px]" style={{ color: 'var(--muted)', marginTop: 2 }}>{s.l}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <div style={{ borderTop: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '96px 36px' }}>
          <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '2.5px', color: 'var(--green)', marginBottom: 14 }}>HOW IT WORKS</div>
          <h2 style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 'clamp(30px,4.5vw,50px)', fontWeight: 900, letterSpacing: '-1.5px', lineHeight: 1.08, marginBottom: 14 }}>Four steps.<br />Infinite strategy.</h2>
          <p style={{ fontSize: 15, color: 'var(--text2)', lineHeight: 1.7, maxWidth: 460, marginBottom: 56 }}>Unlike any fantasy game you've played before — strategy runs live, not just at kickoff.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {[
              { n: '01', i: '🏟️', t: 'Pick a match', d: 'Cricket or football — join a live room or create your own with custom stakes.' },
              { n: '02', i: '🎯', t: 'Build your squad', d: 'Select 11 players on an interactive field. Position them where you want.' },
              { n: '03', i: '⚡', t: 'Assign power', d: 'Distribute 33 power across your squad via sliders. Max 6x, min 1x per player.' },
              { n: '04', i: '🔄', t: 'Reshuffle live', d: 'Every 5 overs a blind window opens. Reshuffle power before opponents see your move.' },
            ].map(c => (
              <div key={c.n} className="transition-all hover:-translate-y-1" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '26px 22px' }}>
                <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 48, fontWeight: 900, color: 'var(--faint)', letterSpacing: '-2px', lineHeight: 1, marginBottom: 16 }}>{c.n}</div>
                <div style={{ fontSize: 26, marginBottom: 12 }}>{c.i}</div>
                <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 16, fontWeight: 800, marginBottom: 8 }}>{c.t}</div>
                <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>{c.d}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ MULTI-SPORT ═══ */}
      <div style={{ borderTop: '1px solid var(--border)', background: 'var(--bg2)' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '96px 36px' }}>
          <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '2.5px', color: 'var(--green)', marginBottom: 14 }}>MULTI-SPORT</div>
          <h2 style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 'clamp(30px,4.5vw,50px)', fontWeight: 900, letterSpacing: '-1.5px', lineHeight: 1.08, marginBottom: 14 }}>One platform.<br />Every sport.</h2>
          <p style={{ fontSize: 15, color: 'var(--text2)', lineHeight: 1.7, maxWidth: 460, marginBottom: 56 }}>Cricket and football are live now. More sports coming as the platform grows.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {[
              { icon: '🏏', name: 'Cricket', desc: 'ODIs, T20s, Tests — fantasy powered by the Power mechanic with per-over reshuffle windows.', features: ['Live during ODIs, T20s and Tests', 'Reshuffle every 5 overs', 'Points: runs × power, wickets × power'], live: true },
              { icon: '⚽', name: 'Football', desc: 'EPL, La Liga, Serie A — reshuffle at half-time and during tactical windows throughout the match.', features: ['EPL, La Liga, Serie A, Champions League', 'Reshuffle at half-time + 60 min window', 'Points: goals, assists, clean sheets × power'], live: true },
            ].map(s => (
              <Link key={s.name} to="/games" className="block no-underline transition-all hover:-translate-y-1" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 32, position: 'relative', overflow: 'hidden' }}>
                {s.live && <div className="absolute top-5 right-5"><span className="badge badge-green">● LIVE</span></div>}
                <div style={{ fontSize: 52, marginBottom: 20 }}>{s.icon}</div>
                <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 28, fontWeight: 900, letterSpacing: '-1px', marginBottom: 8 }}>{s.name}</div>
                <div style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 20 }}>{s.desc}</div>
                <div className="flex flex-col gap-1.5">
                  {s.features.map(f => (
                    <div key={f} className="flex items-center gap-2 text-[13px]" style={{ color: 'var(--text2)' }}>
                      <div className="w-[5px] h-[5px] rounded-full shrink-0" style={{ background: 'var(--green)' }} />
                      {f}
                    </div>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ UPCOMING GAMES PREVIEW ═══ */}
      {(cricketUp.length > 0 || footballUp.length > 0 || live.length > 0) && (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          <div style={{ maxWidth: 1080, margin: '0 auto', padding: '80px 36px' }}>
            {live.length > 0 && (
              <div className="mb-12">
                <div className="flex items-center gap-2 mb-4" style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '2px', color: 'var(--red)' }}>
                  <span className="animate-pulse-slow">●</span> LIVE NOW
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {live.slice(0, 3).map(r => <GameCard key={r.id} room={r} />)}
                </div>
              </div>
            )}
            {cricketUp.length > 0 && (
              <div className="mb-12">
                <div className="flex items-center justify-between mb-4">
                  <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '2px', color: 'var(--muted)' }}>🏏 UPCOMING CRICKET</div>
                  <Link to="/games" className="text-[12px] font-semibold no-underline" style={{ color: 'var(--green)' }}>View all →</Link>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {cricketUp.map(r => <GameCard key={r.id} room={r} />)}
                </div>
              </div>
            )}
            {footballUp.length > 0 && (
              <div className="mb-12">
                <div className="flex items-center justify-between mb-4">
                  <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '2px', color: 'var(--muted)' }}>⚽ UPCOMING FOOTBALL</div>
                  <Link to="/games" className="text-[12px] font-semibold no-underline" style={{ color: 'var(--green)' }}>View all →</Link>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {footballUp.map(r => <GameCard key={r.id} room={r} />)}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ CTA ═══ */}
      <div className="text-center" style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: '80px 36px' }}>
        <h2 style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 'clamp(32px,5vw,56px)', fontWeight: 900, letterSpacing: '-1.5px', marginBottom: 14 }}>Ready to play smarter?</h2>
        <p className="text-[16px] mb-9" style={{ color: 'var(--text2)' }}>Join 14,000+ players already on Crowdbash across cricket and football.</p>
        <Link to="/games" className="inline-block no-underline transition-all hover:-translate-y-0.5" style={{ fontFamily: "'Cabinet Grotesk', sans-serif", background: 'var(--green)', color: '#071a0e', borderRadius: 11, padding: '15px 36px', fontSize: 16, fontWeight: 800 }}>
          Find a live game →
        </Link>
      </div>
    </div>
  );
}

/* ═══ GAME CARD ═══ */
function GameCard({ room }: { room: Room }) {
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
            {isCricket ? '🏏' : '⚽'} {room.match_format || room.league || (isCricket ? 'Cricket' : 'Football')}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="text-center flex-1">
            <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 24, fontWeight: 900, letterSpacing: '-0.5px' }}>{a1}</div>
            <div className="text-[11px]" style={{ color: 'var(--muted)' }}>{t1.length > 15 ? t1.slice(0, 15) + '...' : t1}</div>
          </div>
          <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 10, fontWeight: 700, color: 'var(--faint)', padding: '0 12px' }}>vs</div>
          <div className="text-center flex-1">
            <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 24, fontWeight: 900, letterSpacing: '-0.5px' }}>{a2}</div>
            <div className="text-[11px]" style={{ color: 'var(--muted)' }}>{t2.length > 15 ? t2.slice(0, 15) + '...' : t2}</div>
          </div>
        </div>
      </div>
      <div style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="text-[11px]" style={{ color: 'var(--muted)' }}>{room.league || ''}</div>
        <div className="flex items-center gap-2">
          <span style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 12, fontWeight: 700, color: 'var(--green)', background: 'rgba(45,214,122,0.08)', borderRadius: 6, padding: '3px 9px' }}>₹10</span>
          <span className="btn btn-primary" style={{ padding: '6px 16px', fontSize: 12, borderRadius: 7 }}>{isLive ? 'Join' : 'Play'}</span>
        </div>
      </div>
    </Link>
  );
}
