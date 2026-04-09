import { useRoomStore } from '../../store/roomStore';
import type { CricketScoreData, FootballScoreData } from '../../types';

export function MatchHeader() {
  const score = useRoomStore((s) => s.score);
  const sport = useRoomStore((s) => s.sport);

  if (sport === 'football') {
    return <FootballMatchHeader score={score as FootballScoreData | null} />;
  }
  return <CricketMatchHeader score={score as CricketScoreData | null} />;
}

function CricketMatchHeader({ score }: { score: CricketScoreData | null }) {
  const team1Name = score?.team1?.name || 'TBD';
  const team1Score = score?.team1?.score || '\u2014';
  const team1Overs = score?.team1?.overs ? `${score.team1.overs} ov` : '\u2014';
  const team2Name = score?.team2?.name || 'TBD';
  const team2Score = score?.team2?.score || '\u2014';
  const team2Overs = score?.team2?.overs ? `${score.team2.overs} ov` : '\u2014';
  const crr = score?.current_rate || 0;

  return (
    <div style={{ padding: '16px 16px 12px', borderBottom: '0.5px solid var(--b1)' }}>
      <div className="text-[10px] uppercase tracking-[1px] mb-2" style={{ color: 'var(--mu)' }}>
        Live Match &middot; Cricket
      </div>
      <div className="flex items-center justify-between">
        <div className="text-center">
          <div className="font-syne text-[11px] font-bold" style={{ color: 'var(--mu)' }}>{team1Name}</div>
          <div className="font-syne text-xl font-extrabold leading-none mt-0.5" style={{ color: 'var(--tx)' }}>{team1Score}</div>
          <div className="text-[10px] mt-0.5" style={{ color: 'var(--mu)' }}>{team1Overs}</div>
        </div>
        <div className="text-base" style={{ color: 'var(--dm)' }}>/</div>
        <div className="text-center">
          <div className="font-syne text-[11px] font-bold" style={{ color: 'var(--mu)' }}>{team2Name}</div>
          <div className="font-syne text-xl font-extrabold leading-none mt-0.5" style={{ color: 'var(--tx)' }}>{team2Score}</div>
          <div className="text-[10px] mt-0.5" style={{ color: 'var(--mu)' }}>{team2Overs}</div>
        </div>
      </div>
      <div className="flex justify-between mt-2.5">
        {[
          { label: 'CRR', value: crr > 0 ? crr.toFixed(2) : '\u2014' },
          { label: 'Last 5', value: '\u2014' },
          { label: "P'ship", value: '\u2014' },
        ].map((item) => (
          <div key={item.label} className="text-center">
            <div className="text-[9px] uppercase tracking-[0.5px]" style={{ color: 'var(--mu)' }}>{item.label}</div>
            <div className="text-xs font-medium mt-0.5" style={{ color: 'var(--gold)' }}>{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FootballMatchHeader({ score }: { score: FootballScoreData | null }) {
  const homeName = score?.home?.name || 'Home';
  const homeGoals = score?.home?.goals ?? '\u2014';
  const awayName = score?.away?.name || 'Away';
  const awayGoals = score?.away?.goals ?? '\u2014';
  const minute = score?.minute || 0;
  const half = score?.half || 1;

  return (
    <div style={{ padding: '16px 16px 12px', borderBottom: '0.5px solid var(--b1)' }}>
      <div className="text-[10px] uppercase tracking-[1px] mb-2" style={{ color: 'var(--mu)' }}>
        Live Match &middot; Football
      </div>
      <div className="flex items-center justify-between">
        <div className="text-center flex-1">
          <div className="font-syne text-[11px] font-bold" style={{ color: 'var(--mu)' }}>{homeName}</div>
          <div className="font-syne text-2xl font-extrabold leading-none mt-0.5" style={{ color: 'var(--tx)' }}>{homeGoals}</div>
        </div>
        <div className="px-3 text-center">
          <div className="font-syne text-sm font-bold" style={{ color: 'var(--gold)' }}>{minute}&apos;</div>
          <div className="text-[9px]" style={{ color: 'var(--mu)' }}>{half === 1 ? '1H' : '2H'}</div>
        </div>
        <div className="text-center flex-1">
          <div className="font-syne text-[11px] font-bold" style={{ color: 'var(--mu)' }}>{awayName}</div>
          <div className="font-syne text-2xl font-extrabold leading-none mt-0.5" style={{ color: 'var(--tx)' }}>{awayGoals}</div>
        </div>
      </div>
      <div className="flex justify-between mt-2.5">
        {[
          { label: 'Possession', value: score?.possession_home ? `${score.possession_home}%` : '\u2014' },
          { label: 'Half', value: half === 1 ? '1st' : '2nd' },
          { label: 'Status', value: score?.status || 'Live' },
        ].map((item) => (
          <div key={item.label} className="text-center">
            <div className="text-[9px] uppercase tracking-[0.5px]" style={{ color: 'var(--mu)' }}>{item.label}</div>
            <div className="text-xs font-medium mt-0.5" style={{ color: 'var(--gold)' }}>{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
