import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../lib/api';
import type { Room } from '../../types';
import { formatMatchDate } from '../../types';
import { useAuthStore } from '../../store/authStore';
import { LeaderboardTab } from './LeaderboardTab';

interface MatchDetails {
  status: string;
  sport: string;
  match_name?: string;
  result?: string;
  // Football
  home_team?: string;
  away_team?: string;
  home_goals?: number;
  away_goals?: number;
  halftime?: string;
  scorers?: Array<{ name: string; minute: number; type: string }>;
  cards?: Array<{ name: string; card: string; minute: number }>;
  // Football stats (from enrichment)
  possession_home?: number;
  possession_away?: number;
  shots?: string[];
  corners?: string[];
  fouls?: string[];
  yellow_cards?: string[];
  shots_on_target?: string[];
  // Cricket
  teams?: Array<{ name: string; score: string; overs: string }>;
  top_batters?: Array<{ name: string; runs: number; balls: number; team: string }>;
  top_bowlers?: Array<{ name: string; wickets: number; runs_conceded: number; overs: string }>;
  player_of_match?: string;
  // Cricket stats (from enrichment)
  detailed_batters?: Array<{ name: string; runs: number; balls: number }>;
  detailed_bowlers?: Array<{ name: string; wickets: number; runs: number }>;
}

interface MvpPlayer {
  player_id: string;
  player_name: string;
  team: string;
  role: string;
  total_points: number;
  pick_count: number;
  pick_pct: number;
}

interface MyTeamPlayer {
  player_id: string;
  player_name: string;
  team: string;
  weightage: number;
  points_earned: number;
  player_role: string;
  selected: boolean;
}

interface CompletedMatchViewProps {
  room: Room;
}

export function CompletedMatchView({ room }: CompletedMatchViewProps) {
  const [details, setDetails] = useState<MatchDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [mvp, setMvp] = useState<{ total_squads: number; top_players: MvpPlayer[] } | null>(null);
  const [myTeam, setMyTeam] = useState<{ total_points: number; players: MyTeamPlayer[] } | null>(null);
  const [myRank, setMyRank] = useState<{ rank: number; total: number } | null>(null);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    // First try match_progress from room data
    const progress = room.match_progress || {};
    if (progress.status === 'closed') {
      setDetails(progress as unknown as MatchDetails);
      setLoading(false);
    } else {
      // Otherwise fetch room detail
      (async () => {
        try {
          const { data } = await api.get(`/api/rooms/${room.id}`);
          const mp = data.match_progress || {};
          if (mp.status === 'closed') setDetails(mp as MatchDetails);
        } catch { /* no details available */ }
        finally { setLoading(false); }
      })();
    }

    // Fantasy MVP — top contributors across all squads in this room
    (async () => {
      try {
        const { data } = await api.get(`/api/rooms/${room.id}/mvp`);
        setMvp(data);
      } catch { /* mvp endpoint may not be deployed yet */ }
    })();

    // My team + my rank (only if signed in)
    if (user?.id) {
      (async () => {
        try {
          const { data } = await api.get(`/api/game/${room.id}/team/${user.id}`);
          const players = (data.player_weightages || []) as MyTeamPlayer[];
          setMyTeam({
            total_points: data.total_points || 0,
            players: players.sort((a, b) => b.points_earned - a.points_earned),
          });
        } catch { /* user didn't play this match */ }
      })();
      (async () => {
        try {
          const { data } = await api.get(`/api/leaderboard/${room.id}`);
          const total = Array.isArray(data) ? data.length : 0;
          const idx = Array.isArray(data) ? data.findIndex((e: { user_id: string }) => e.user_id === user.id) : -1;
          if (idx >= 0) setMyRank({ rank: idx + 1, total });
        } catch { /* leaderboard not available */ }
      })();
    }
  }, [room, user?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="font-syne" style={{ color: 'var(--mu)' }}>Loading match details...</div>
      </div>
    );
  }

  return (
    <div className="px-4 md:px-8 py-6 md:py-7 mx-auto" style={{ maxWidth: 920 }}>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6">
        <Link to="/" className="text-xs no-underline" style={{ color: 'var(--gold)' }}>Home</Link>
        <span className="text-[10px]" style={{ color: 'var(--dm)' }}>/</span>
        {room.league && (
          <>
            <Link to={`/league/${encodeURIComponent(room.league)}`} className="text-xs no-underline" style={{ color: 'var(--gold)' }}>
              {room.league}
            </Link>
            <span className="text-[10px]" style={{ color: 'var(--dm)' }}>/</span>
          </>
        )}
        <span className="text-xs" style={{ color: 'var(--mu)' }}>{room.match_name}</span>
      </div>

      {/* Match header */}
      <div
        className="rounded-[14px] p-6 mb-6"
        style={{ background: 'var(--s1)', border: '0.5px solid var(--b1)' }}
      >
        <div className="text-[10px] uppercase tracking-[1px] mb-4" style={{ color: 'var(--mu)' }}>
          {room.sport === 'football' ? '⚽' : '🏏'} {room.league || room.match_format} · Match Result
        </div>
        {room.match_date && (
          <div className="text-[12px] mb-4" style={{ color: 'var(--gold)' }}>
            {formatMatchDate(room.match_date)}
          </div>
        )}

        {room.sport === 'football' && details ? (
          <FootballDetail details={details} />
        ) : room.sport === 'cricket' && details ? (
          <CricketDetail details={details} />
        ) : (
          <div>
            <div className="font-syne text-xl font-extrabold mb-2" style={{ color: 'var(--tx)' }}>
              {room.match_name}
            </div>
            <div className="text-[13px]" style={{ color: 'var(--mu)' }}>
              Match completed. Detailed scorecard not available.
            </div>
          </div>
        )}
      </div>

      {/* ── Your Final Position + Fantasy MVP (side by side on md+) ── */}
      {(myRank || (mvp && mvp.top_players.length > 0)) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {myRank && myTeam && (
            <div className="rounded-[14px] p-5" style={{ background: 'var(--s1)', border: '0.5px solid var(--b1)' }}>
              <div className="text-[10px] uppercase tracking-[1px] mb-3" style={{ color: 'var(--mu)' }}>Your Final Position</div>
              <div className="flex items-baseline gap-2 mb-1">
                <span style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 36, fontWeight: 900, color: myRank.rank === 1 ? 'var(--amber)' : 'var(--text)', lineHeight: 1 }}>
                  #{myRank.rank}
                </span>
                <span className="text-[12px]" style={{ color: 'var(--mu)' }}>of {myRank.total}</span>
                {myRank.rank === 1 && <span style={{ fontSize: 20 }}>🥇</span>}
                {myRank.rank === 2 && <span style={{ fontSize: 20 }}>🥈</span>}
                {myRank.rank === 3 && <span style={{ fontSize: 20 }}>🥉</span>}
              </div>
              <div className="flex items-center gap-4 mt-3 pt-3" style={{ borderTop: '0.5px solid var(--b1)' }}>
                <div>
                  <div className="text-[10px]" style={{ color: 'var(--mu)' }}>Total points</div>
                  <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{myTeam.total_points.toLocaleString()}</div>
                </div>
                {myTeam.players[0] && myTeam.players[0].points_earned > 0 && (
                  <div className="flex-1">
                    <div className="text-[10px]" style={{ color: 'var(--mu)' }}>Your top scorer</div>
                    <div className="text-[13px] font-semibold truncate" style={{ color: 'var(--green)' }}>
                      {myTeam.players[0].player_name} <span style={{ color: 'var(--mu)', fontWeight: 400 }}>· +{myTeam.players[0].points_earned}</span>
                    </div>
                  </div>
                )}
              </div>
              {myRank.rank <= 3 && (myTeam.total_points > 0) && (
                <div className="text-[10px] mt-3" style={{ color: 'var(--green)' }}>
                  🪙 You earned {myRank.rank === 1 ? '+100' : myRank.rank === 2 ? '+50' : '+25'} coins (× tier multiplier)
                </div>
              )}
            </div>
          )}

          {mvp && mvp.top_players.length > 0 && (
            <div className="rounded-[14px] p-5" style={{ background: 'var(--s1)', border: '0.5px solid var(--b1)' }}>
              <div className="text-[10px] uppercase tracking-[1px] mb-3" style={{ color: 'var(--mu)' }}>🏆 Fantasy Man of the Match</div>
              <div className="flex items-baseline gap-2 mb-1">
                <span style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 18, fontWeight: 900, color: 'var(--text)' }}>
                  {mvp.top_players[0].player_name}
                </span>
              </div>
              <div className="text-[11px] mb-3" style={{ color: 'var(--mu)' }}>
                {mvp.top_players[0].team}{mvp.top_players[0].role ? ` · ${mvp.top_players[0].role}` : ''}
              </div>
              <div className="flex items-center gap-4 pt-3" style={{ borderTop: '0.5px solid var(--b1)' }}>
                <div>
                  <div className="text-[10px]" style={{ color: 'var(--mu)' }}>Total points generated</div>
                  <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 20, fontWeight: 800, color: 'var(--amber)' }}>+{mvp.top_players[0].total_points}</div>
                </div>
                <div>
                  <div className="text-[10px]" style={{ color: 'var(--mu)' }}>Picked by</div>
                  <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{mvp.top_players[0].pick_pct}%</div>
                </div>
              </div>
              {mvp.top_players.length > 1 && (
                <div className="mt-3 pt-3" style={{ borderTop: '0.5px solid var(--b1)' }}>
                  <div className="text-[10px] mb-2" style={{ color: 'var(--mu)' }}>Other top scorers</div>
                  {mvp.top_players.slice(1, 4).map(p => (
                    <div key={p.player_id} className="flex items-center justify-between py-1">
                      <div className="text-[12px] truncate" style={{ color: 'var(--text)' }}>{p.player_name} <span className="text-[10px]" style={{ color: 'var(--mu)' }}>· {p.team}</span></div>
                      <div className="text-[12px] font-bold" style={{ color: 'var(--green)' }}>+{p.total_points}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Your Squad (collapsible-style block) ── */}
      {myTeam && myTeam.players.length > 0 && (
        <div className="rounded-[14px] p-5 mb-6" style={{ background: 'var(--s1)', border: '0.5px solid var(--b1)' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] uppercase tracking-[1px]" style={{ color: 'var(--mu)' }}>Your Squad ({myTeam.players.length})</div>
            <div className="text-[11px]" style={{ color: 'var(--mu)' }}>Sorted by points</div>
          </div>
          <div>
            {myTeam.players.map((p, i) => (
              <div key={p.player_id} className="flex items-center gap-3 py-2.5" style={{ borderBottom: i < myTeam.players.length - 1 ? '0.5px solid var(--b1)' : 'none' }}>
                <div style={{ width: 18, fontSize: 11, color: 'var(--mu)', textAlign: 'right', fontFamily: "'Cabinet Grotesk', sans-serif" }}>{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold truncate" style={{ color: 'var(--text)' }}>{p.player_name}</div>
                  <div className="text-[10px]" style={{ color: 'var(--mu)' }}>{p.team}{p.player_role ? ` · ${p.player_role}` : ''}</div>
                </div>
                <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 13, fontWeight: 800, color: 'var(--amber)', minWidth: 32, textAlign: 'right' }}>{p.weightage}x</div>
                <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 14, fontWeight: 900, color: p.points_earned > 0 ? 'var(--green)' : 'var(--mu)', minWidth: 50, textAlign: 'right' }}>
                  {p.points_earned > 0 ? `+${p.points_earned}` : '0'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Final Leaderboard ── */}
      <div className="rounded-[14px] mb-6 overflow-hidden" style={{ background: 'var(--s1)', border: '0.5px solid var(--b1)' }}>
        <LeaderboardTab roomId={room.id} matchStarted={true} />
      </div>

      {/* Match info */}
      <div
        className="rounded-[14px] p-5"
        style={{ background: 'var(--s1)', border: '0.5px solid var(--b1)' }}
      >
        <div className="text-[10px] uppercase tracking-[1px] mb-3" style={{ color: 'var(--mu)' }}>
          Match Info
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Competition', value: room.league || room.match_format },
            { label: 'Venue', value: room.venue || '—' },
            { label: 'Format', value: room.match_format || '—' },
            { label: 'Sport', value: room.sport === 'football' ? 'Football' : 'Cricket' },
          ].map((item) => (
            <div key={item.label}>
              <div className="text-[10px]" style={{ color: 'var(--mu)' }}>{item.label}</div>
              <div className="text-[13px] font-medium capitalize" style={{ color: 'var(--tx)' }}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FootballDetail({ details }: { details: MatchDetails }) {
  return (
    <div>
      {/* Score */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex-1">
          <div className="font-syne text-lg font-bold" style={{ color: 'var(--tx)' }}>
            {details.home_team}
          </div>
        </div>
        <div className="px-6 text-center">
          <div className="font-syne text-3xl font-extrabold" style={{ color: 'var(--gold)' }}>
            {details.home_goals} - {details.away_goals}
          </div>
          <div className="text-[10px] mt-1" style={{ color: 'var(--mu)' }}>
            Full Time {details.halftime ? `(HT: ${details.halftime})` : ''}
          </div>
        </div>
        <div className="flex-1 text-right">
          <div className="font-syne text-lg font-bold" style={{ color: 'var(--tx)' }}>
            {details.away_team}
          </div>
        </div>
      </div>

      {/* Result */}
      <div
        className="text-center text-[13px] font-semibold py-2 rounded-lg mb-4"
        style={{ background: 'rgba(61,214,140,0.08)', color: 'var(--green)' }}
      >
        {details.result}
      </div>

      {/* Goals */}
      {details.scorers && details.scorers.length > 0 && (
        <div className="mb-4">
          <div className="text-[10px] uppercase tracking-[1px] mb-2" style={{ color: 'var(--mu)' }}>
            Goals
          </div>
          {details.scorers.map((s, i) => (
            <div key={i} className="flex items-center gap-3 py-1.5" style={{ borderBottom: '0.5px solid var(--b1)' }}>
              <span className="text-sm">⚽</span>
              <span className="text-[13px] flex-1" style={{ color: 'var(--tx)' }}>{s.name}</span>
              <span className="text-[12px]" style={{ color: 'var(--mu)' }}>{s.minute}'</span>
              {s.type !== 'REGULAR' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--s2)', color: 'var(--mu)' }}>
                  {s.type === 'OWN_GOAL' ? 'OG' : s.type === 'PENALTY' ? 'PEN' : s.type}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Cards */}
      {details.cards && details.cards.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-[1px] mb-2" style={{ color: 'var(--mu)' }}>
            Disciplinary
          </div>
          {details.cards.map((c, i) => (
            <div key={i} className="flex items-center gap-3 py-1.5" style={{ borderBottom: '0.5px solid var(--b1)' }}>
              <span className="text-sm">{c.card === 'RED' || c.card === 'YELLOW_RED' ? '🟥' : '🟨'}</span>
              <span className="text-[13px] flex-1" style={{ color: 'var(--tx)' }}>{c.name}</span>
              <span className="text-[12px]" style={{ color: 'var(--mu)' }}>{c.minute}'</span>
            </div>
          ))}
        </div>
      )}

      {/* Match Stats */}
      {details.possession_home != null && (
        <div className="mt-4 pt-4" style={{ borderTop: '0.5px solid var(--b1)' }}>
          <div className="text-[10px] uppercase tracking-[1px] mb-3" style={{ color: 'var(--mu)' }}>
            Match Statistics
          </div>
          <div className="space-y-2.5">
            <StatRow label="Possession" home={`${details.possession_home}%`} away={`${details.possession_away}%`} />
            {details.shots && details.shots.length >= 2 && (
              <StatRow label="Shots" home={details.shots[0]} away={details.shots[1]} />
            )}
            {details.shots_on_target && details.shots_on_target.length >= 2 && (
              <StatRow label="Shots on Target" home={details.shots_on_target[0]} away={details.shots_on_target[1]} />
            )}
            {details.corners && details.corners.length >= 2 && (
              <StatRow label="Corners" home={details.corners[0]} away={details.corners[1]} />
            )}
            {details.fouls && details.fouls.length >= 2 && (
              <StatRow label="Fouls" home={details.fouls[0]} away={details.fouls[1]} />
            )}
            {details.yellow_cards && details.yellow_cards.length >= 2 && (
              <StatRow label="Yellow Cards" home={details.yellow_cards[0]} away={details.yellow_cards[1]} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatRow({ label, home, away }: { label: string; home: string; away: string }) {
  return (
    <div className="flex items-center">
      <span className="text-[13px] font-medium w-10 text-center" style={{ color: 'var(--tx)' }}>{home}</span>
      <div className="flex-1 mx-3">
        <div className="text-[11px] text-center" style={{ color: 'var(--mu)' }}>{label}</div>
      </div>
      <span className="text-[13px] font-medium w-10 text-center" style={{ color: 'var(--tx)' }}>{away}</span>
    </div>
  );
}

function CricketDetail({ details }: { details: MatchDetails }) {
  return (
    <div>
      {/* Team scores */}
      {details.teams && details.teams.map((team, i) => (
        <div
          key={i}
          className="flex items-center justify-between py-3"
          style={{ borderBottom: i === 0 ? '0.5px solid var(--b1)' : 'none' }}
        >
          <div className="font-syne text-lg font-bold" style={{ color: 'var(--tx)' }}>
            {team.name}
          </div>
          <div className="text-right">
            <span className="font-syne text-xl font-extrabold" style={{ color: 'var(--gold)' }}>
              {team.score}
            </span>
            <span className="text-[11px] ml-1.5" style={{ color: 'var(--mu)' }}>
              ({team.overs} ov)
            </span>
          </div>
        </div>
      ))}

      {/* Result */}
      {details.result && (
        <div
          className="text-center text-[13px] font-semibold py-2 rounded-lg my-4"
          style={{ background: 'rgba(61,214,140,0.08)', color: 'var(--green)' }}
        >
          {details.result}
          {details.player_of_match && (
            <div className="text-[11px] font-normal mt-1" style={{ color: 'var(--gold)' }}>
              Player of the Match: {details.player_of_match}
            </div>
          )}
        </div>
      )}

      {/* Top batters */}
      {details.top_batters && details.top_batters.length > 0 && (
        <div className="mb-4">
          <div className="text-[10px] uppercase tracking-[1px] mb-2" style={{ color: 'var(--mu)' }}>
            Top Batters
          </div>
          {details.top_batters.map((b, i) => (
            <div key={i} className="flex items-center justify-between py-1.5" style={{ borderBottom: '0.5px solid var(--b1)' }}>
              <div>
                <span className="text-[13px]" style={{ color: 'var(--tx)' }}>{b.name}</span>
                <span className="text-[10px] ml-2" style={{ color: 'var(--mu)' }}>{b.team}</span>
              </div>
              <div>
                <span className="font-syne text-[13px] font-bold" style={{ color: 'var(--gold)' }}>{b.runs}</span>
                <span className="text-[10px] ml-1" style={{ color: 'var(--mu)' }}>({b.balls}b)</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Top bowlers */}
      {details.top_bowlers && details.top_bowlers.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-[1px] mb-2" style={{ color: 'var(--mu)' }}>
            Top Bowlers
          </div>
          {details.top_bowlers.map((b, i) => (
            <div key={i} className="flex items-center justify-between py-1.5" style={{ borderBottom: '0.5px solid var(--b1)' }}>
              <span className="text-[13px]" style={{ color: 'var(--tx)' }}>{b.name}</span>
              <div>
                <span className="font-syne text-[13px] font-bold" style={{ color: 'var(--blue)' }}>
                  {b.wickets}/{b.runs_conceded}
                </span>
                <span className="text-[10px] ml-1" style={{ color: 'var(--mu)' }}>({b.overs} ov)</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
