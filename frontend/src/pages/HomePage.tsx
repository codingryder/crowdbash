import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import type { Room } from '../types';
import { formatMatchDate, splitTeams, teamAbbr, cricketAbbr } from '../types';

export function HomePage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [_loading, setLoading] = useState(true);
  const [howItWorksSport, setHowItWorksSport] = useState<'cricket' | 'football'>('cricket');

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

  const upcoming = rooms.filter(r => r.status === 'open').sort((a, b) => {
    const da = a.match_date ? new Date(a.match_date).getTime() : Infinity;
    const db = b.match_date ? new Date(b.match_date).getTime() : Infinity;
    return da - db;
  });
  const live = rooms.filter(r => r.status === 'locked');
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

        <div className="relative z-10 text-center w-full" style={{ maxWidth: 860 }}>
          <div className="inline-flex items-center gap-2 rounded-full mb-9 animate-fadeup" style={{ background: 'var(--surface)', border: '1px solid var(--border2)', padding: '6px 18px', fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>
            <div className="w-1.5 h-1.5 rounded-full animate-pulse-slow" style={{ background: 'var(--green)' }} />
            🆓 Free to play · Skill-based sports fantasy
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
            <a href="#how-it-works" className="no-underline transition-all" style={{ fontFamily: "'Cabinet Grotesk', sans-serif", background: 'transparent', color: 'var(--text2)', border: '1px solid var(--border2)', borderRadius: 11, padding: '15px 28px', fontSize: 15, fontWeight: 600 }}>
              How it works ↓
            </a>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 mt-14 pt-10 animate-fadeup" style={{ borderTop: '1px solid var(--border)', animationDelay: '.45s' }}>
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

          <div className="flex flex-wrap items-center justify-center mt-6 animate-fadeup" style={{ animationDelay: '.5s' }}>
            {[
              { i: '⚡', t: 'Live reshuffle', s: 'Change power mid-match' },
              { i: '🎯', t: 'Power mechanic', s: '33 power across 11 players' },
              { i: '🆓', t: 'Free to play', s: 'No entry fees' },
              { i: '📡', t: 'Real-time data', s: 'Live ESPN match feeds' },
            ].map((f, idx) => (
              <div key={f.t} className="flex items-center">
                {idx > 0 && <div className="mx-3 md:mx-8" style={{ width: 1, height: 44, background: 'var(--border)' }} />}
                <div className="text-center">
                  <div style={{ fontSize: 24, lineHeight: 1, marginBottom: 6 }}>{f.i}</div>
                  <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{f.t}</div>
                  <div className="text-[10px]" style={{ color: 'var(--muted)', marginTop: 2 }}>{f.s}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <div id="how-it-works" style={{ borderTop: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '96px 36px' }}>
          <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '2.5px', color: 'var(--green)', marginBottom: 14 }}>HOW IT WORKS</div>
          <h2 style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 'clamp(30px,4.5vw,50px)', fontWeight: 900, letterSpacing: '-1.5px', lineHeight: 1.08, marginBottom: 14 }}>Four steps.<br />Infinite strategy.</h2>
          <p style={{ fontSize: 15, color: 'var(--text2)', lineHeight: 1.7, maxWidth: 460, marginBottom: 28 }}>Unlike any fantasy game you've played before — strategy runs live, not just at kickoff.</p>

          {/* Sport toggle */}
          <div className="inline-flex items-center gap-0.5 rounded-full mb-9" style={{ background: 'var(--surface)', padding: 4, border: '1px solid var(--border)' }}>
            {([
              { key: 'cricket' as const, icon: '🏏', label: 'Cricket' },
              { key: 'football' as const, icon: '⚽', label: 'Football' },
            ]).map(t => {
              const active = howItWorksSport === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setHowItWorksSport(t.key)}
                  className="flex items-center gap-1.5 rounded-full cursor-pointer border-none"
                  style={{
                    padding: '7px 18px',
                    fontFamily: "'Cabinet Grotesk', sans-serif",
                    fontSize: 13,
                    fontWeight: 700,
                    background: active ? 'var(--surface3)' : 'transparent',
                    color: active ? 'var(--text)' : 'var(--muted)',
                  }}
                >
                  <span style={{ fontSize: 14 }}>{t.icon}</span> {t.label}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {(howItWorksSport === 'cricket' ? [
              { n: '01', i: '🏟️', t: 'Pick a match', d: 'Join a live cricket room (IPL, internationals, T20 leagues) or create your own.' },
              { n: '02', i: '🎯', t: 'Build your XI', d: 'Pick 11 from both squads. Caps: max 6 batters, max 5 bowlers, max 3 all-rounders, ≥1 keeper.' },
              { n: '03', i: '⚡', t: 'Assign power', d: 'Distribute 33 power across your XI via sliders. Max 6×, min 1× per player.' },
              { n: '04', i: '🔄', t: 'Reshuffle live', d: 'Three blind windows: after 10 overs of innings 1, at the innings break, and after 10 overs of innings 2.' },
            ] : [
              { n: '01', i: '🏟️', t: 'Pick a match', d: 'Join a live football room — EPL, La Liga, Serie A, Bundesliga, Champions League and more.' },
              { n: '02', i: '🎯', t: 'Build your XI', d: 'Pick 11 from both teams across GK, DEF, MID, FWD. Real lineups load before kickoff.' },
              { n: '03', i: '⚡', t: 'Assign power', d: 'Distribute 33 power across your XI via sliders. Max 6×, min 1× per player.' },
              { n: '04', i: '🔄', t: 'Reshuffle live', d: 'Half-time blind window opens to redistribute power based on how the match is unfolding.' },
            ]).map(c => (
              <div key={c.n} className="transition-all hover:-translate-y-1" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '26px 22px' }}>
                <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 48, fontWeight: 900, color: 'var(--faint)', letterSpacing: '-2px', lineHeight: 1, marginBottom: 16 }}>{c.n}</div>
                <div style={{ fontSize: 26, marginBottom: 12 }}>{c.i}</div>
                <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 16, fontWeight: 800, marginBottom: 8 }}>{c.t}</div>
                <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>{c.d}</div>
              </div>
            ))}
          </div>

          {/* Sport-specific scoring footnote */}
          <div className="mt-8 text-[12px]" style={{ color: 'var(--muted)', maxWidth: 720, lineHeight: 1.6 }}>
            {howItWorksSport === 'cricket' ? (
              <><span style={{ color: 'var(--text)', fontWeight: 700 }}>Scoring:</span> +1 per run · +4 boundary bonus on every four · +6 on every six (so a four = 8 pts, a six = 12). Milestones: +25 at 50, +50 at 100. Duck: −5. Bowling: +25/wicket · +10/maiden · +25 for a 3-wicket haul · +50 for 5+. Fielding: +10/catch · +15/stumping · +10/run-out. Your contribution = (fantasy points × power).</>
            ) : (
              <><span style={{ color: 'var(--text)', fontWeight: 700 }}>Scoring:</span> 6pt/goal · 3pt/assist · 4pt/clean sheet (DEF/GK) · 1pt/match played. Cards: −1 yellow, −3 red. Own goal: −2. Your score = fantasy points × power.</>
            )}
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
              {
                icon: '🏏',
                name: 'Cricket',
                desc: 'IPL, internationals, T20 leagues — fantasy powered by the Power mechanic with three blind reshuffle windows per match.',
                features: [
                  'Live during ODIs, T20s and Tests',
                  '3 reshuffles: 10 ov in, innings break, 10 ov in chase',
                  'Points: 1pt/run · 4/4s · 6/6s · 25pt/wicket × power',
                ],
                live: true,
              },
              {
                icon: '⚽',
                name: 'Football',
                desc: 'EPL, La Liga, Serie A, Bundesliga, Champions League — reshuffle your power at half-time based on how the match is unfolding.',
                features: [
                  'EPL, La Liga, Serie A, Bundesliga, UCL & more',
                  'Half-time blind reshuffle window',
                  'Points: 6/goal · 3/assist · 4/clean sheet × power',
                ],
                live: true,
              },
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

      {/* ═══ BASHPOINTS ═══
          Public-facing section. We deliberately do NOT mention vouchers,
          cash rewards, or redemption value here — that framing only
          appears for signed-in users on /rewards and inside game rooms.
          Public messaging stays focused on free-to-play + skill-based
          fan engagement. */}
      <div style={{ borderTop: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '96px 36px' }}>
          <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '2.5px', color: 'var(--green)', marginBottom: 14 }}>BASHPOINTS</div>
          <h2 style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 'clamp(30px,4.5vw,50px)', fontWeight: 900, letterSpacing: '-1.5px', lineHeight: 1.08, marginBottom: 14 }}>Earn Bashpoints.<br />Climb the leaderboard.</h2>
          <p style={{ fontSize: 15, color: 'var(--text2)', lineHeight: 1.7, maxWidth: 540, marginBottom: 56 }}>
            🆓 100% free to play. Bashpoints are your fan-engagement score —
            earned by skill: building strong fantasy XIs, allocating power
            wisely, and reshuffling at the right moments.
          </p>

          <div className="grid gap-4 mb-10" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            {[
              { icon: '🎁', title: '+50 signup bonus', desc: 'One-time, when you verify your email.' },
              { icon: '🗓️', title: '+10 daily check-in', desc: 'Sign in each day to keep your streak alive.' },
              { icon: '🥇', title: 'Top-3 match recognition', desc: 'Place 1st / 2nd / 3rd in a room to earn extra Bashpoints.' },
              { icon: '⚡', title: 'Tier multipliers', desc: 'Bronze 1× · Silver 1.25× · Gold 1.5× · Platinum 2×' },
            ].map(c => (
              <div key={c.title} className="transition-all hover:-translate-y-1" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '22px 20px' }}>
                <div style={{ fontSize: 28, marginBottom: 12 }}>{c.icon}</div>
                <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 15, fontWeight: 800, marginBottom: 6 }}>{c.title}</div>
                <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.55 }}>{c.desc}</div>
              </div>
            ))}
          </div>

          <Link to="/rewards" className="inline-block no-underline transition-all hover:-translate-y-0.5" style={{ fontFamily: "'Cabinet Grotesk', sans-serif", background: 'var(--green)', color: '#071a0e', borderRadius: 11, padding: '13px 28px', fontSize: 15, fontWeight: 800 }}>
            View your Bashpoints
          </Link>
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
        <p className="text-[16px] mb-9" style={{ color: 'var(--text2)' }}>🆓 100% free — pick a live cricket or football room and start earning Bashpoints.</p>
        <Link to="/games" className="inline-block no-underline transition-all hover:-translate-y-0.5" style={{ fontFamily: "'Cabinet Grotesk', sans-serif", background: 'var(--green)', color: '#071a0e', borderRadius: 11, padding: '15px 36px', fontSize: 16, fontWeight: 800 }}>
          Find a live game room →
        </Link>
      </div>
    </div>
  );
}

/* ═══ GAME CARD ═══ */
function GameCard({ room }: { room: Room }) {
  const [t1, t2] = splitTeams(room.match_name);
  const isCricket = room.sport === 'cricket';
  const fallback = isCricket ? cricketAbbr : teamAbbr;
  const a1 = fallback(t1);
  const a2 = fallback(t2);
  const isLive = room.status === 'locked';

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
