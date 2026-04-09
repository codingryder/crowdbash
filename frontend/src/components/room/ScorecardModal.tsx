import { useState, useEffect } from 'react';
import api from '../../lib/api';

interface ScorecardModalProps {
  roomId: string;
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

export function ScorecardModal({ roomId, roomName, onClose }: ScorecardModalProps) {
  const [innings, setInnings] = useState<InningsData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeInnings, setActiveInnings] = useState(0);
  const [teamScores, setTeamScores] = useState<{
    team1?: { name: string; score: string; overs: string };
    team2?: { name: string; score: string; overs: string };
    status?: string;
  }>({});

  useEffect(() => {
    async function fetchScorecard() {
      try {
        const { data } = await api.get(`/api/rooms/scorecard/${roomId}`);
        if (data.scorecard?.innings) {
          setInnings(data.scorecard.innings);
        }
        if (data.scorecard) {
          setTeamScores({
            team1: data.scorecard.team1,
            team2: data.scorecard.team2,
            status: data.scorecard.status,
          });
        }
      } catch {
        // No scorecard
      } finally {
        setLoading(false);
      }
    }
    fetchScorecard();
  }, [roomId]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl w-full max-w-3xl mx-4 max-h-[80vh] flex flex-col"
        style={{ background: 'var(--s1)', border: '0.5px solid var(--b1)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: '0.5px solid var(--b1)' }}>
          <div>
            <div className="font-syne text-lg font-bold" style={{ color: 'var(--gold)' }}>Scorecard</div>
            <div className="text-[12px]" style={{ color: 'var(--mu)' }}>{roomName}</div>
          </div>
          <button onClick={onClose} className="text-lg cursor-pointer bg-transparent border-none" style={{ color: 'var(--mu)' }}>✕</button>
        </div>

        {loading ? (
          <div className="p-8 text-center" style={{ color: 'var(--mu)' }}>Loading scorecard...</div>
        ) : innings.length === 0 ? (
          <div className="p-8 text-center" style={{ color: 'var(--mu)' }}>Scorecard not available yet</div>
        ) : (
          <>
            {/* Innings tabs */}
            <div className="flex px-4 shrink-0" style={{ borderBottom: '0.5px solid var(--b1)' }}>
              {innings.map((inn, i) => (
                <button
                  key={i}
                  onClick={() => setActiveInnings(i)}
                  className="px-4 py-2.5 text-[12px] relative bg-transparent border-none cursor-pointer"
                  style={{ color: activeInnings === i ? 'var(--gold)' : 'var(--mu)', fontFamily: "'DM Sans', sans-serif" }}
                >
                  {inn.name.length > 25 ? inn.name.slice(0, 25) + '...' : inn.name}
                  {activeInnings === i && (
                    <span className="absolute bottom-0 left-[10%] right-[10%] h-[1.5px] rounded" style={{ background: 'var(--gold)' }} />
                  )}
                </button>
              ))}
            </div>

            {/* Scorecard content */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {/* Team scores summary */}
              {(teamScores.team1 || teamScores.team2) && (
                <div className="flex items-center justify-between mb-4 px-2 py-3 rounded-lg" style={{ background: 'var(--s2)' }}>
                  <div>
                    <div className="text-[12px] font-medium" style={{ color: 'var(--tx)' }}>{teamScores.team1?.name}</div>
                    <div className="font-syne text-lg font-bold" style={{ color: 'var(--gold)' }}>
                      {teamScores.team1?.score || '—'} <span className="text-[10px] font-normal" style={{ color: 'var(--mu)' }}>({teamScores.team1?.overs || '—'} ov)</span>
                    </div>
                  </div>
                  <div className="text-[11px]" style={{ color: 'var(--dm)' }}>vs</div>
                  <div className="text-right">
                    <div className="text-[12px] font-medium" style={{ color: 'var(--tx)' }}>{teamScores.team2?.name}</div>
                    <div className="font-syne text-lg font-bold" style={{ color: 'var(--gold)' }}>
                      {teamScores.team2?.score || '—'} <span className="text-[10px] font-normal" style={{ color: 'var(--mu)' }}>({teamScores.team2?.overs || '—'} ov)</span>
                    </div>
                  </div>
                </div>
              )}
              {teamScores.status && (
                <div className="text-[11px] text-center mb-4" style={{ color: 'var(--green)' }}>{teamScores.status}</div>
              )}

              {innings[activeInnings] && (
                <>
                  {/* Batting */}
                  <div className="text-[10px] uppercase tracking-[1px] mb-2" style={{ color: 'var(--mu)' }}>Batting</div>
                  <table className="w-full mb-6" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '0.5px solid var(--b1)' }}>
                        <th className="text-left py-2 text-[10px] font-normal" style={{ color: 'var(--mu)' }}>Batter</th>
                        <th className="text-right py-2 text-[10px] font-normal px-2" style={{ color: 'var(--mu)' }}>R</th>
                        <th className="text-right py-2 text-[10px] font-normal px-2" style={{ color: 'var(--mu)' }}>B</th>
                        <th className="text-right py-2 text-[10px] font-normal px-2" style={{ color: 'var(--mu)' }}>4s</th>
                        <th className="text-right py-2 text-[10px] font-normal px-2" style={{ color: 'var(--mu)' }}>6s</th>
                        <th className="text-right py-2 text-[10px] font-normal px-2" style={{ color: 'var(--mu)' }}>SR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {innings[activeInnings].batting.map((b, i) => (
                        <tr key={i} style={{ borderBottom: '0.5px solid var(--b1)' }}>
                          <td className="py-2">
                            <div className="text-[12px] font-medium" style={{ color: 'var(--tx)' }}>{b.name}</div>
                            {b.dismissal && b.dismissal !== 'not out' && b.dismissal !== 'batting' && (
                              <div className="text-[10px]" style={{ color: 'var(--dm)' }}>{b.dismissal}</div>
                            )}
                            {(!b.dismissal || b.dismissal === 'not out' || b.dismissal === 'batting') && (
                              <div className="text-[10px]" style={{ color: 'var(--green)' }}>not out</div>
                            )}
                          </td>
                          <td className="text-right px-2 font-syne text-[13px] font-bold" style={{ color: 'var(--gold)' }}>{b.runs}</td>
                          <td className="text-right px-2 text-[12px]" style={{ color: 'var(--mu)' }}>{b.balls}</td>
                          <td className="text-right px-2 text-[12px]" style={{ color: 'var(--blue)' }}>{b.fours}</td>
                          <td className="text-right px-2 text-[12px]" style={{ color: 'var(--gold)' }}>{b.sixes}</td>
                          <td className="text-right px-2 text-[12px]" style={{ color: 'var(--mu)' }}>{b.sr}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Bowling */}
                  <div className="text-[10px] uppercase tracking-[1px] mb-2" style={{ color: 'var(--mu)' }}>Bowling</div>
                  <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '0.5px solid var(--b1)' }}>
                        <th className="text-left py-2 text-[10px] font-normal" style={{ color: 'var(--mu)' }}>Bowler</th>
                        <th className="text-right py-2 text-[10px] font-normal px-2" style={{ color: 'var(--mu)' }}>O</th>
                        <th className="text-right py-2 text-[10px] font-normal px-2" style={{ color: 'var(--mu)' }}>M</th>
                        <th className="text-right py-2 text-[10px] font-normal px-2" style={{ color: 'var(--mu)' }}>R</th>
                        <th className="text-right py-2 text-[10px] font-normal px-2" style={{ color: 'var(--mu)' }}>W</th>
                        <th className="text-right py-2 text-[10px] font-normal px-2" style={{ color: 'var(--mu)' }}>Econ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {innings[activeInnings].bowling.map((b, i) => (
                        <tr key={i} style={{ borderBottom: '0.5px solid var(--b1)' }}>
                          <td className="py-2 text-[12px] font-medium" style={{ color: 'var(--tx)' }}>{b.name}</td>
                          <td className="text-right px-2 text-[12px]" style={{ color: 'var(--mu)' }}>{b.overs}</td>
                          <td className="text-right px-2 text-[12px]" style={{ color: 'var(--mu)' }}>{b.maidens}</td>
                          <td className="text-right px-2 text-[12px]" style={{ color: 'var(--mu)' }}>{b.runs}</td>
                          <td className="text-right px-2 font-syne text-[13px] font-bold" style={{ color: 'var(--green)' }}>{b.wickets}</td>
                          <td className="text-right px-2 text-[12px]" style={{ color: 'var(--mu)' }}>{b.economy}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Live match note */}
                  <div className="text-center mt-4 py-3 rounded-lg" style={{ background: 'var(--s2)' }}>
                    <div className="text-[11px]" style={{ color: 'var(--mu)' }}>
                      📡 Live scorecard — updates as players bat and bowl
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
