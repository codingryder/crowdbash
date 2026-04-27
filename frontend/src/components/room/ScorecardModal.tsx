import { useState, useEffect } from 'react';
import api from '../../lib/api';
import { useIsMobile } from '../../hooks/useIsMobile';

interface ScorecardModalProps {
  /** Provide roomId for room-based scorecard */
  roomId?: string;
  /** Provide sport + matchId for direct API scorecard (Live Matches) */
  sport?: string;
  matchId?: string;
  roomName: string;
  onClose: () => void;
}

interface BatterRow {
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  dismissal: string;
  sr: number;
}

interface BowlerRow {
  name: string;
  overs: string;
  maidens: number;
  runs: number;
  wickets: number;
  economy: number;
}

interface InningsData {
  name: string;
  batting: BatterRow[];
  bowling: BowlerRow[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ScorecardData = Record<string, any>;

export function ScorecardModal({ roomId, sport, matchId, roomName, onClose }: ScorecardModalProps) {
  const [innings, setInnings] = useState<InningsData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeInnings, setActiveInnings] = useState(0);
  const [scorecard, setScorecard] = useState<ScorecardData | null>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    async function fetchScorecard() {
      try {
        let url: string;
        if (roomId) {
          url = `/api/rooms/scorecard/${roomId}`;
        } else if (sport && matchId) {
          url = `/api/matches/scorecard/${sport}/${matchId}?match_name=${encodeURIComponent(roomName)}`;
        } else {
          return;
        }
        const { data } = await api.get(url);
        if (data.scorecard) {
          setScorecard(data.scorecard);
          if (data.scorecard.innings) {
            setInnings(data.scorecard.innings);
          }
        }
      } catch {
        // No scorecard
      } finally {
        setLoading(false);
      }
    }
    fetchScorecard();
    // Auto-refresh every 30 seconds for live data
    const interval = setInterval(fetchScorecard, 30000);
    return () => clearInterval(interval);
  }, [roomId, sport, matchId, roomName]);

  const isCricket = scorecard?.sport === 'cricket' || sport === 'cricket';
  const isFootball = scorecard?.sport === 'football' || sport === 'football';
  const hasDetailedInnings = innings.length > 0 && innings.some(i => i.batting.length > 0 || i.bowling.length > 0);

  // Team scores — support both cricket (team1/team2) and football (home/away) formats
  const team1Name = scorecard?.team1?.name || scorecard?.home?.name || '';
  const team2Name = scorecard?.team2?.name || scorecard?.away?.name || '';
  const team1Score = scorecard?.team1?.score || scorecard?.home?.goals?.toString() || '—';
  const team2Score = scorecard?.team2?.score || scorecard?.away?.goals?.toString() || '—';
  const team1Overs = scorecard?.team1?.overs || '';
  const team2Overs = scorecard?.team2?.overs || '';
  const statusText = scorecard?.status || '';

  // On mobile, slide up from the bottom — matches the score / match-info
  // sheet pattern. Trigger the slide-in one frame after mount so the
  // transform transition actually runs (instead of starting at translateY(0)).
  const [mobileVisible, setMobileVisible] = useState(false);
  useEffect(() => {
    if (!isMobile) return;
    const id = requestAnimationFrame(() => setMobileVisible(true));
    return () => cancelAnimationFrame(id);
  }, [isMobile]);

  return (
    <div
      className={isMobile ? '' : 'fixed inset-0 flex items-center justify-center'}
      style={
        isMobile
          ? { position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }
          : { background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 60 }
      }
      onClick={onClose}
    >
      <div
        className={isMobile ? 'flex flex-col' : 'rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col'}
        style={
          isMobile
            ? {
                position: 'fixed', left: 0, right: 0, bottom: 0,
                height: '88vh', maxHeight: '88vh',
                background: 'var(--bg2)',
                borderTop: '1px solid var(--border)',
                borderTopLeftRadius: 16, borderTopRightRadius: 16,
                boxShadow: '0 -10px 30px rgba(0,0,0,0.45)',
                transform: mobileVisible ? 'translateY(0)' : 'translateY(100%)',
                transition: 'transform 240ms cubic-bezier(0.32,0.72,0,1)',
                paddingBottom: 'env(safe-area-inset-bottom)',
              }
            : { background: 'var(--surface)', border: '1px solid var(--border)', margin: '0 16px' }
        }
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drag handle */}
        {isMobile && (
          <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'center', padding: '8px 0 4px' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)' }} />
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>
              {isFootball ? 'Match Score' : 'Scorecard'}
            </div>
            <div className="text-[12px]" style={{ color: 'var(--muted)' }}>{roomName}</div>
          </div>
          <button onClick={onClose} className="text-lg cursor-pointer bg-transparent border-none" style={{ color: 'var(--muted)' }}>✕</button>
        </div>

        {loading ? (
          <div className="p-8 text-center" style={{ color: 'var(--muted)' }}>Loading scorecard...</div>
        ) : !scorecard ? (
          <div className="p-8 text-center" style={{ color: 'var(--muted)' }}>Scorecard not available yet</div>
        ) : (
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {/* Score summary — always shown */}
            {(team1Name || team2Name) && (
              <div className="flex items-center justify-between mb-4 px-4 py-4 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                <div className="text-center flex-1">
                  <div className="text-[12px] font-medium mb-1" style={{ color: 'var(--muted)' }}>{team1Name}</div>
                  <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: isFootball ? 36 : 22, fontWeight: 900, color: 'var(--text)' }}>
                    {team1Score}
                  </div>
                  {isCricket && team1Overs && (
                    <div className="text-[10px] mt-1" style={{ color: 'var(--muted)' }}>({team1Overs} ov)</div>
                  )}
                </div>
                <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 12, fontWeight: 700, color: 'var(--faint)', padding: '0 16px' }}>vs</div>
                <div className="text-center flex-1">
                  <div className="text-[12px] font-medium mb-1" style={{ color: 'var(--muted)' }}>{team2Name}</div>
                  <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: isFootball ? 36 : 22, fontWeight: 900, color: 'var(--text)' }}>
                    {team2Score}
                  </div>
                  {isCricket && team2Overs && (
                    <div className="text-[10px] mt-1" style={{ color: 'var(--muted)' }}>({team2Overs} ov)</div>
                  )}
                </div>
              </div>
            )}

            {/* Status text */}
            {statusText && (
              <div className="text-[12px] text-center mb-4 font-semibold" style={{ color: 'var(--green)' }}>{statusText}</div>
            )}

            {/* Football-specific info */}
            {isFootball && scorecard?.is_live && scorecard?.minute > 0 && (
              <div className="text-center mb-4">
                <span className="text-[11px] px-3 py-1 rounded-full" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                  {scorecard.minute}' {scorecard.half === 2 ? '2nd Half' : '1st Half'}
                </span>
              </div>
            )}

            {/* Goal scorers — prominent right below the score */}
            {isFootball && Array.isArray(scorecard?.events) && (() => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const goals = scorecard.events.filter((e: any) => e.is_goal);
              if (goals.length === 0) return null;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const homeGoals = goals.filter((g: any) => g.team === 'home');
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const awayGoals = goals.filter((g: any) => g.team === 'away');
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const renderGoal = (g: any, i: number) => (
                <div key={i} className="flex items-baseline gap-1.5 text-[12px]" style={{ color: 'var(--text)' }}>
                  <span style={{ fontSize: 11 }}>⚽</span>
                  <span style={{ fontWeight: 600 }}>{g.player || 'Goal'}</span>
                  <span className="text-[10px]" style={{ color: 'var(--muted)' }}>
                    {g.minute}'{g.is_own_goal ? ' (OG)' : ''}{g.is_penalty ? ' (P)' : ''}
                  </span>
                </div>
              );
              return (
                <div className="mb-4 px-4 py-3 rounded-lg" style={{ background: 'rgba(45,214,122,0.04)', border: '1px solid rgba(45,214,122,0.18)' }}>
                  <div className="text-[10px] uppercase tracking-[1.5px] mb-2" style={{ color: 'var(--green)' }}>⚽ Goals</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      {homeGoals.length > 0 ? homeGoals.map(renderGoal) : <div className="text-[11px]" style={{ color: 'var(--faint)' }}>—</div>}
                    </div>
                    <div className="flex flex-col gap-1 items-end text-right">
                      {awayGoals.length > 0 ? awayGoals.map(renderGoal) : <div className="text-[11px]" style={{ color: 'var(--faint)' }}>—</div>}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Football match info card */}
            {isFootball && (scorecard?.league || scorecard?.venue || scorecard?.kickoff) && (
              <div className="mb-4 px-4 py-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                <div className="text-[10px] uppercase tracking-[1.5px] mb-2" style={{ color: 'var(--muted)' }}>Match Info</div>
                <div className="grid grid-cols-1 gap-1.5 text-[12px]">
                  {scorecard?.league && (
                    <div className="flex gap-2"><span style={{ color: 'var(--muted)', width: 18 }}>🏆</span><span style={{ color: 'var(--text)' }}>{scorecard.league}</span></div>
                  )}
                  {scorecard?.venue && (
                    <div className="flex gap-2"><span style={{ color: 'var(--muted)', width: 18 }}>🏟️</span><span style={{ color: 'var(--text)' }}>{scorecard.venue}</span></div>
                  )}
                  {!scorecard?.is_live && scorecard?.kickoff && (
                    <div className="flex gap-2"><span style={{ color: 'var(--muted)', width: 18 }}>🕒</span><span style={{ color: 'var(--text)' }}>{new Date(scorecard.kickoff).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></div>
                  )}
                  {scorecard?.attendance > 0 && (
                    <div className="flex gap-2"><span style={{ color: 'var(--muted)', width: 18 }}>👥</span><span style={{ color: 'var(--text)' }}>{scorecard.attendance.toLocaleString()} attending</span></div>
                  )}
                  {Array.isArray(scorecard?.broadcasts) && scorecard.broadcasts.length > 0 && (
                    <div className="flex gap-2"><span style={{ color: 'var(--muted)', width: 18 }}>📺</span><span style={{ color: 'var(--text)' }}>{scorecard.broadcasts.join(', ')}</span></div>
                  )}
                </div>
              </div>
            )}

            {/* Recent form */}
            {isFootball && (scorecard?.form?.home || scorecard?.form?.away) && (
              <div className="mb-4 px-4 py-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                <div className="text-[10px] uppercase tracking-[1.5px] mb-2" style={{ color: 'var(--muted)' }}>Recent Form</div>
                <div className="grid grid-cols-2 gap-3">
                  {(['home', 'away'] as const).map((side) => {
                    const form = scorecard?.form?.[side] || '';
                    const teamName = side === 'home' ? team1Name : team2Name;
                    const record = scorecard?.record?.[side] || '';
                    return (
                      <div key={side}>
                        <div className="text-[11px] mb-1" style={{ color: 'var(--muted)' }}>{teamName}</div>
                        <div className="flex gap-1 mb-1">
                          {form.split('').slice(-5).map((c: string, i: number) => (
                            <span key={i} className="inline-flex items-center justify-center text-[10px] font-bold rounded" style={{
                              width: 18, height: 18,
                              background: c === 'W' ? 'rgba(45,214,122,0.15)' : c === 'L' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                              color: c === 'W' ? '#2dd67a' : c === 'L' ? '#ef4444' : '#f59e0b',
                            }}>{c}</span>
                          ))}
                        </div>
                        {record && <div className="text-[10px]" style={{ color: 'var(--muted)' }}>{record}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Match events timeline */}
            {isFootball && Array.isArray(scorecard?.events) && scorecard.events.length > 0 && (
              <div className="mb-4">
                <div className="text-[10px] uppercase tracking-[1.5px] mb-2" style={{ color: 'var(--muted)' }}>Match Events</div>
                <div className="rounded-lg overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {scorecard.events.map((ev: any, i: number) => {
                    const icon = ev.is_goal ? (ev.is_own_goal ? '🥅' : '⚽') : ev.is_red ? '🟥' : ev.is_yellow ? '🟨' : '•';
                    const isHome = ev.team === 'home';
                    return (
                      <div key={i} className="flex items-center gap-3 px-3 py-2" style={{ borderBottom: i < scorecard.events.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <div className="text-[11px] font-bold" style={{ fontFamily: "'Cabinet Grotesk', sans-serif", color: 'var(--muted)', width: 32 }}>{ev.minute}'</div>
                        <div style={{ fontSize: 14 }}>{icon}</div>
                        <div className="flex-1 text-[12px]" style={{ color: 'var(--text)' }}>
                          <span style={{ fontWeight: ev.is_goal ? 700 : 400 }}>{ev.player || ev.type}</span>
                          {ev.player && <span className="ml-1.5 text-[10px]" style={{ color: 'var(--muted)' }}>{ev.type}</span>}
                        </div>
                        <div className="text-[10px]" style={{ color: 'var(--muted)' }}>{isHome ? team1Name : team2Name}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Team stats comparison */}
            {isFootball && (() => {
              const stats = scorecard?.stats || {};
              const rows: { label: string; key: string }[] = [
                { label: 'Possession %', key: 'possessionPct' },
                { label: 'Shots', key: 'totalShots' },
                { label: 'On Target', key: 'shotsOnTarget' },
                { label: 'Corners', key: 'wonCorners' },
                { label: 'Fouls', key: 'foulsCommitted' },
              ];
              const visible = rows.filter(r => stats.home?.[r.key] !== undefined || stats.away?.[r.key] !== undefined);
              if (visible.length === 0) return null;
              return (
                <div className="mb-4">
                  <div className="text-[10px] uppercase tracking-[1.5px] mb-2" style={{ color: 'var(--muted)' }}>Team Stats</div>
                  <div className="rounded-lg px-4 py-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                    {visible.map(r => {
                      const h = parseFloat(stats.home?.[r.key] ?? '0') || 0;
                      const a = parseFloat(stats.away?.[r.key] ?? '0') || 0;
                      const total = h + a;
                      const hPct = total > 0 ? (h / total) * 100 : 50;
                      return (
                        <div key={r.key} className="mb-2.5 last:mb-0">
                          <div className="flex justify-between items-center mb-1 text-[11px]">
                            <span style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 700, color: 'var(--text)' }}>{stats.home?.[r.key] ?? '—'}</span>
                            <span style={{ color: 'var(--muted)' }}>{r.label}</span>
                            <span style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 700, color: 'var(--text)' }}>{stats.away?.[r.key] ?? '—'}</span>
                          </div>
                          <div className="flex h-1.5 rounded overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                            <div style={{ width: `${hPct}%`, background: 'var(--green)' }} />
                            <div style={{ width: `${100 - hPct}%`, background: 'var(--blue)' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Detailed innings (cricket with full scorecard) */}
            {hasDetailedInnings && (
              <>
                {/* Innings tabs */}
                <div className="flex mb-3 gap-1" style={{ borderBottom: '1px solid var(--border)' }}>
                  {innings.map((inn, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveInnings(i)}
                      className="px-4 py-2.5 text-[12px] relative bg-transparent border-none cursor-pointer"
                      style={{ color: activeInnings === i ? 'var(--green)' : 'var(--muted)', fontFamily: "'DM Sans', sans-serif" }}
                    >
                      {inn.name.length > 25 ? inn.name.slice(0, 25) + '...' : inn.name}
                      {activeInnings === i && (
                        <span className="absolute bottom-0 left-[10%] right-[10%] h-[1.5px] rounded" style={{ background: 'var(--green)' }} />
                      )}
                    </button>
                  ))}
                </div>

                {innings[activeInnings] && (
                  <>
                    {/* Batting */}
                    {innings[activeInnings].batting.length > 0 && (
                      <>
                        <div className="text-[10px] uppercase tracking-[1px] mb-2" style={{ color: 'var(--muted)' }}>Batting</div>
                        <table className="w-full mb-6" style={{ borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)' }}>
                              <th className="text-left py-2 text-[10px] font-normal" style={{ color: 'var(--muted)' }}>Batter</th>
                              <th className="text-right py-2 text-[10px] font-normal" style={{ color: 'var(--muted)', padding: isMobile ? '8px 4px' : '8px' }}>R</th>
                              <th className="text-right py-2 text-[10px] font-normal" style={{ color: 'var(--muted)', padding: isMobile ? '8px 4px' : '8px' }}>B</th>
                              <th className="text-right py-2 text-[10px] font-normal" style={{ color: 'var(--muted)', padding: isMobile ? '8px 4px' : '8px' }}>4s</th>
                              <th className="text-right py-2 text-[10px] font-normal" style={{ color: 'var(--muted)', padding: isMobile ? '8px 4px' : '8px' }}>6s</th>
                              {!isMobile && <th className="text-right py-2 text-[10px] font-normal px-2" style={{ color: 'var(--muted)' }}>SR</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {innings[activeInnings].batting.map((b, i) => (
                              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td className="py-2" style={{ minWidth: 0 }}>
                                  <div className="text-[12px] font-medium" style={{ color: 'var(--text)' }}>{b.name}</div>
                                  {b.dismissal && b.dismissal !== 'not out' && b.dismissal !== 'batting' ? (
                                    <div className="text-[10px]" style={{ color: 'var(--text2)' }}>{b.dismissal}{isMobile ? ` · SR ${b.sr}` : ''}</div>
                                  ) : (
                                    <div className="text-[10px]" style={{ color: 'var(--green)' }}>not out{isMobile ? ` · SR ${b.sr}` : ''}</div>
                                  )}
                                </td>
                                <td className="text-right text-[13px] font-bold" style={{ fontFamily: "'Cabinet Grotesk', sans-serif", color: 'var(--text)', padding: isMobile ? '8px 4px' : '8px' }}>{b.runs}</td>
                                <td className="text-right text-[12px]" style={{ color: 'var(--muted)', padding: isMobile ? '8px 4px' : '8px' }}>{b.balls}</td>
                                <td className="text-right text-[12px]" style={{ color: 'var(--blue)', padding: isMobile ? '8px 4px' : '8px' }}>{b.fours}</td>
                                <td className="text-right text-[12px]" style={{ color: 'var(--amber)', padding: isMobile ? '8px 4px' : '8px' }}>{b.sixes}</td>
                                {!isMobile && <td className="text-right px-2 text-[12px]" style={{ color: 'var(--muted)' }}>{b.sr}</td>}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </>
                    )}

                    {/* Bowling */}
                    {innings[activeInnings].bowling.length > 0 && (
                      <>
                        <div className="text-[10px] uppercase tracking-[1px] mb-2" style={{ color: 'var(--muted)' }}>Bowling</div>
                        <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)' }}>
                              <th className="text-left py-2 text-[10px] font-normal" style={{ color: 'var(--muted)' }}>Bowler</th>
                              <th className="text-right py-2 text-[10px] font-normal" style={{ color: 'var(--muted)', padding: isMobile ? '8px 4px' : '8px' }}>O</th>
                              {!isMobile && <th className="text-right py-2 text-[10px] font-normal px-2" style={{ color: 'var(--muted)' }}>M</th>}
                              <th className="text-right py-2 text-[10px] font-normal" style={{ color: 'var(--muted)', padding: isMobile ? '8px 4px' : '8px' }}>R</th>
                              <th className="text-right py-2 text-[10px] font-normal" style={{ color: 'var(--muted)', padding: isMobile ? '8px 4px' : '8px' }}>W</th>
                              <th className="text-right py-2 text-[10px] font-normal" style={{ color: 'var(--muted)', padding: isMobile ? '8px 4px' : '8px' }}>Econ</th>
                            </tr>
                          </thead>
                          <tbody>
                            {innings[activeInnings].bowling.map((b, i) => (
                              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td className="py-2 text-[12px] font-medium" style={{ color: 'var(--text)' }}>{b.name}</td>
                                <td className="text-right text-[12px]" style={{ color: 'var(--muted)', padding: isMobile ? '8px 4px' : '8px' }}>{b.overs}</td>
                                {!isMobile && <td className="text-right px-2 text-[12px]" style={{ color: 'var(--muted)' }}>{b.maidens}</td>}
                                <td className="text-right text-[12px]" style={{ color: 'var(--muted)', padding: isMobile ? '8px 4px' : '8px' }}>{b.runs}</td>
                                <td className="text-right text-[13px] font-bold" style={{ fontFamily: "'Cabinet Grotesk', sans-serif", color: 'var(--green)', padding: isMobile ? '8px 4px' : '8px' }}>{b.wickets}</td>
                                <td className="text-right text-[12px]" style={{ color: 'var(--muted)', padding: isMobile ? '8px 4px' : '8px' }}>{b.economy}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </>
                    )}
                  </>
                )}
              </>
            )}

            {/* No detailed data note (cricket only — football has its own rich sections above) */}
            {!hasDetailedInnings && !isFootball && (
              <div className="text-center py-4 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <div className="text-[11px]" style={{ color: 'var(--muted)' }}>
                  📡 Live score summary — detailed scorecard updates during the match
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
