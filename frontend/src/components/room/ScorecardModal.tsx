import { useState, useEffect } from 'react';
import api from '../../lib/api';

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl w-full max-w-3xl mx-4 max-h-[80vh] flex flex-col"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
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
            {isFootball && scorecard?.minute && (
              <div className="text-center mb-4">
                <span className="text-[11px] px-3 py-1 rounded-full" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                  {scorecard.minute}' {scorecard.half === 2 ? '2nd Half' : '1st Half'}
                </span>
              </div>
            )}

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
                              <th className="text-right py-2 text-[10px] font-normal px-2" style={{ color: 'var(--muted)' }}>R</th>
                              <th className="text-right py-2 text-[10px] font-normal px-2" style={{ color: 'var(--muted)' }}>B</th>
                              <th className="text-right py-2 text-[10px] font-normal px-2" style={{ color: 'var(--muted)' }}>4s</th>
                              <th className="text-right py-2 text-[10px] font-normal px-2" style={{ color: 'var(--muted)' }}>6s</th>
                              <th className="text-right py-2 text-[10px] font-normal px-2" style={{ color: 'var(--muted)' }}>SR</th>
                            </tr>
                          </thead>
                          <tbody>
                            {innings[activeInnings].batting.map((b, i) => (
                              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td className="py-2">
                                  <div className="text-[12px] font-medium" style={{ color: 'var(--text)' }}>{b.name}</div>
                                  {b.dismissal && b.dismissal !== 'not out' && b.dismissal !== 'batting' ? (
                                    <div className="text-[10px]" style={{ color: 'var(--faint)' }}>{b.dismissal}</div>
                                  ) : (
                                    <div className="text-[10px]" style={{ color: 'var(--green)' }}>not out</div>
                                  )}
                                </td>
                                <td className="text-right px-2 text-[13px] font-bold" style={{ fontFamily: "'Cabinet Grotesk', sans-serif", color: 'var(--text)' }}>{b.runs}</td>
                                <td className="text-right px-2 text-[12px]" style={{ color: 'var(--muted)' }}>{b.balls}</td>
                                <td className="text-right px-2 text-[12px]" style={{ color: 'var(--blue)' }}>{b.fours}</td>
                                <td className="text-right px-2 text-[12px]" style={{ color: 'var(--amber)' }}>{b.sixes}</td>
                                <td className="text-right px-2 text-[12px]" style={{ color: 'var(--muted)' }}>{b.sr}</td>
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
                              <th className="text-right py-2 text-[10px] font-normal px-2" style={{ color: 'var(--muted)' }}>O</th>
                              <th className="text-right py-2 text-[10px] font-normal px-2" style={{ color: 'var(--muted)' }}>M</th>
                              <th className="text-right py-2 text-[10px] font-normal px-2" style={{ color: 'var(--muted)' }}>R</th>
                              <th className="text-right py-2 text-[10px] font-normal px-2" style={{ color: 'var(--muted)' }}>W</th>
                              <th className="text-right py-2 text-[10px] font-normal px-2" style={{ color: 'var(--muted)' }}>Econ</th>
                            </tr>
                          </thead>
                          <tbody>
                            {innings[activeInnings].bowling.map((b, i) => (
                              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td className="py-2 text-[12px] font-medium" style={{ color: 'var(--text)' }}>{b.name}</td>
                                <td className="text-right px-2 text-[12px]" style={{ color: 'var(--muted)' }}>{b.overs}</td>
                                <td className="text-right px-2 text-[12px]" style={{ color: 'var(--muted)' }}>{b.maidens}</td>
                                <td className="text-right px-2 text-[12px]" style={{ color: 'var(--muted)' }}>{b.runs}</td>
                                <td className="text-right px-2 text-[13px] font-bold" style={{ fontFamily: "'Cabinet Grotesk', sans-serif", color: 'var(--green)' }}>{b.wickets}</td>
                                <td className="text-right px-2 text-[12px]" style={{ color: 'var(--muted)' }}>{b.economy}</td>
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

            {/* No detailed data note */}
            {!hasDetailedInnings && (
              <div className="text-center py-4 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <div className="text-[11px]" style={{ color: 'var(--muted)' }}>
                  {isFootball ? '⚽ Live football score' : '📡 Live score summary — detailed scorecard updates during the match'}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
