import { useRoomStore } from '../../store/roomStore';
import type { CricketScoreData, FootballScoreData } from '../../types';

/**
 * Standalone score header component (used outside the 3-column room layout).
 * For the room page, MatchHeader in LeftSidebar handles this.
 */
export function ScoreHeader() {
  const score = useRoomStore((s) => s.score);
  const sport = useRoomStore((s) => s.sport);

  if (!score) {
    return (
      <div className="rounded-xl p-4 animate-pulse" style={{ background: 'var(--s2)', border: '0.5px solid var(--b1)' }}>
        <div className="h-12 rounded" style={{ background: 'var(--s3)' }} />
      </div>
    );
  }

  if (sport === 'football') {
    const fs = score as FootballScoreData;
    return (
      <div className="rounded-xl p-4" style={{ background: 'var(--s2)', border: '0.5px solid var(--b1)' }}>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--mu)' }}>{fs.home.name}</p>
            <p className="font-syne font-bold text-2xl mt-0.5">{fs.home.goals}</p>
          </div>
          <div className="px-4 text-center">
            <span className="font-syne text-sm font-bold" style={{ color: 'var(--gold)' }}>{fs.minute}&apos;</span>
          </div>
          <div className="flex-1 text-right">
            <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--mu)' }}>{fs.away.name}</p>
            <p className="font-syne font-bold text-2xl mt-0.5">{fs.away.goals}</p>
          </div>
        </div>
        <div className="mt-3 pt-3 flex items-center justify-between text-xs" style={{ borderTop: '0.5px solid var(--b1)', color: 'var(--mu)' }}>
          <span>{fs.status}</span>
          <span>{fs.half === 1 ? '1st Half' : '2nd Half'}</span>
        </div>
      </div>
    );
  }

  // Cricket
  const cs = score as CricketScoreData;
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--s2)', border: '0.5px solid var(--b1)' }}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--mu)' }}>{cs.team1.name}</p>
          <p className="font-syne font-bold text-2xl mt-0.5">{cs.team1.score}</p>
          <p className="text-xs" style={{ color: 'var(--mu)' }}>({cs.team1.overs} ov)</p>
        </div>
        <div className="px-4">
          <span className="text-xs font-syne" style={{ color: 'var(--dm)' }}>VS</span>
        </div>
        <div className="flex-1 text-right">
          <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--mu)' }}>{cs.team2.name}</p>
          <p className="font-syne font-bold text-2xl mt-0.5">{cs.team2.score}</p>
          <p className="text-xs" style={{ color: 'var(--mu)' }}>({cs.team2.overs} ov)</p>
        </div>
      </div>
      <div className="mt-3 pt-3 flex items-center justify-between text-xs" style={{ borderTop: '0.5px solid var(--b1)', color: 'var(--mu)' }}>
        <span>{cs.status}</span>
        <span>CRR: {cs.current_rate}</span>
      </div>
    </div>
  );
}
