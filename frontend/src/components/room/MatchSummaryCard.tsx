import { Link } from 'react-router-dom';
import type { Room } from '../../types';
import { formatMatchDate } from '../../types';

interface MatchSummaryCardProps {
  room: Room;
}

interface FootballSummary {
  status: string;
  sport: string;
  home_team: string;
  away_team: string;
  home_goals: number;
  away_goals: number;
  halftime: string;
  result: string;
  scorers: Array<{ name: string; minute: number; type: string }>;
  cards: Array<{ name: string; card: string; minute: number }>;
}

interface CricketSummary {
  status: string;
  sport: string;
  result: string;
  teams: Array<{ name: string; score: string; overs: string }>;
  top_batters: Array<{ name: string; runs: number; balls: number; team: string }>;
  top_bowlers: Array<{ name: string; wickets: number; runs_conceded: number; overs: string }>;
}

export function MatchSummaryCard({ room }: MatchSummaryCardProps) {
  const progress = room.match_progress || {};

  // No summary data saved yet
  if (!progress.status || progress.status !== 'completed') {
    return <BasicCompletedCard room={room} />;
  }

  if (room.sport === 'football') {
    return <FootballSummaryCard room={room} summary={progress as unknown as FootballSummary} />;
  }
  return <CricketSummaryCard room={room} summary={progress as unknown as CricketSummary} />;
}

function BasicCompletedCard({ room }: { room: Room }) {
  return (
    <Link
      to={`/room/${room.id}`}
      className="block rounded-[14px] p-4 no-underline transition-all cursor-pointer"
      style={{ background: 'var(--s1)', border: '0.5px solid var(--b1)' }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(244,185,64,0.4)')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--b1)')}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px]" style={{ color: 'var(--mu)' }}>
          {room.match_format}
        </span>
        <span className="text-[10px] px-2 py-0.5 rounded-[20px]"
          style={{ background: 'var(--s2)', color: 'var(--mu)' }}>
          Completed
        </span>
      </div>
      <div className="font-syne text-[14px] font-bold" style={{ color: 'var(--tx)' }}>
        {room.match_name}
      </div>
      <div className="text-[11px] mt-2" style={{ color: 'var(--gold)' }}>
        View details →
      </div>
    </Link>
  );
}

function FootballSummaryCard({ room, summary }: { room: Room; summary: FootballSummary }) {
  return (
    <Link
      to={`/room/${room.id}`}
      className="block rounded-[14px] p-4 no-underline transition-all cursor-pointer"
      style={{ background: 'var(--s1)', border: '0.5px solid var(--b1)' }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(244,185,64,0.4)')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--b1)')}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px]" style={{ color: 'var(--mu)' }}>
          ⚽ {room.league || room.match_format}
        </span>
        <span className="text-[10px] px-2 py-0.5 rounded-[20px]"
          style={{ background: 'var(--s2)', color: 'var(--mu)' }}>
          FT
        </span>
      </div>
      {room.match_date && (
        <div className="text-[10px] mb-3" style={{ color: 'var(--dm)' }}>
          {formatMatchDate(room.match_date, { showTime: false })}
        </div>
      )}

      {/* Score */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex-1">
          <div className="font-syne text-[13px] font-bold" style={{ color: 'var(--tx)' }}>
            {summary.home_team}
          </div>
        </div>
        <div className="px-4 text-center">
          <div className="font-syne text-xl font-extrabold" style={{ color: 'var(--gold)' }}>
            {summary.home_goals} - {summary.away_goals}
          </div>
          <div className="text-[9px]" style={{ color: 'var(--mu)' }}>
            HT: {summary.halftime}
          </div>
        </div>
        <div className="flex-1 text-right">
          <div className="font-syne text-[13px] font-bold" style={{ color: 'var(--tx)' }}>
            {summary.away_team}
          </div>
        </div>
      </div>

      {/* Result */}
      <div className="text-[11px] font-medium mb-2" style={{ color: 'var(--green)' }}>
        {summary.result}
      </div>

      {/* Goalscorers */}
      {summary.scorers && summary.scorers.length > 0 && (
        <div className="mt-2 pt-2" style={{ borderTop: '0.5px solid var(--b1)' }}>
          <div className="text-[9px] uppercase tracking-[1px] mb-1.5" style={{ color: 'var(--mu)' }}>
            Goals
          </div>
          {summary.scorers.map((s, i) => (
            <div key={i} className="flex items-center gap-2 mb-1">
              <span className="text-[11px]">⚽</span>
              <span className="text-[11px]" style={{ color: 'var(--tx)' }}>
                {s.name}
              </span>
              <span className="text-[10px]" style={{ color: 'var(--mu)' }}>
                {s.minute}'
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Cards */}
      {summary.cards && summary.cards.length > 0 && (
        <div className="mt-2 pt-2" style={{ borderTop: '0.5px solid var(--b1)' }}>
          {summary.cards.slice(0, 3).map((c, i) => (
            <div key={i} className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px]">
                {c.card === 'RED' ? '🟥' : '🟨'}
              </span>
              <span className="text-[10px]" style={{ color: 'var(--mu)' }}>
                {c.name} {c.minute}'
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="text-[11px] mt-3 font-medium" style={{ color: 'var(--gold)' }}>
        View full details →
      </div>
    </Link>
  );
}

function CricketSummaryCard({ room, summary }: { room: Room; summary: CricketSummary }) {
  return (
    <Link
      to={`/room/${room.id}`}
      className="block rounded-[14px] p-4 no-underline transition-all cursor-pointer"
      style={{ background: 'var(--s1)', border: '0.5px solid var(--b1)' }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(244,185,64,0.4)')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--b1)')}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px]" style={{ color: 'var(--mu)' }}>
          🏏 {room.league || room.match_format}
        </span>
        <span className="text-[10px] px-2 py-0.5 rounded-[20px]"
          style={{ background: 'var(--s2)', color: 'var(--mu)' }}>
          Result
        </span>
      </div>
      {room.match_date && (
        <div className="text-[10px] mb-3" style={{ color: 'var(--dm)' }}>
          {formatMatchDate(room.match_date, { showTime: false })}
        </div>
      )}

      {/* Team scores */}
      {summary.teams && summary.teams.map((team, i) => (
        <div key={i} className="flex items-center justify-between mb-1">
          <span className="font-syne text-[13px] font-bold" style={{ color: 'var(--tx)' }}>
            {team.name}
          </span>
          <span className="font-syne text-[13px] font-bold" style={{ color: 'var(--gold)' }}>
            {team.score} <span className="text-[10px] font-normal" style={{ color: 'var(--mu)' }}>({team.overs} ov)</span>
          </span>
        </div>
      ))}

      {/* Result */}
      <div className="text-[11px] font-medium mt-2 mb-2" style={{ color: 'var(--green)' }}>
        {summary.result}
      </div>

      {/* Top batters */}
      {summary.top_batters && summary.top_batters.length > 0 && (
        <div className="mt-2 pt-2" style={{ borderTop: '0.5px solid var(--b1)' }}>
          <div className="text-[9px] uppercase tracking-[1px] mb-1.5" style={{ color: 'var(--mu)' }}>
            Top Batters
          </div>
          {summary.top_batters.slice(0, 4).map((b, i) => (
            <div key={i} className="flex items-center justify-between mb-0.5">
              <span className="text-[11px]" style={{ color: 'var(--tx)' }}>{b.name}</span>
              <span className="text-[11px] font-medium" style={{ color: 'var(--gold)' }}>
                {b.runs} ({b.balls})
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Top bowlers */}
      {summary.top_bowlers && summary.top_bowlers.length > 0 && (
        <div className="mt-2 pt-2" style={{ borderTop: '0.5px solid var(--b1)' }}>
          <div className="text-[9px] uppercase tracking-[1px] mb-1.5" style={{ color: 'var(--mu)' }}>
            Top Bowlers
          </div>
          {summary.top_bowlers.slice(0, 3).map((b, i) => (
            <div key={i} className="flex items-center justify-between mb-0.5">
              <span className="text-[11px]" style={{ color: 'var(--tx)' }}>{b.name}</span>
              <span className="text-[11px] font-medium" style={{ color: 'var(--blue)' }}>
                {b.wickets}/{b.runs_conceded} ({b.overs} ov)
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="text-[11px] mt-3 font-medium" style={{ color: 'var(--gold)' }}>
        View full details →
      </div>
    </Link>
  );
}
