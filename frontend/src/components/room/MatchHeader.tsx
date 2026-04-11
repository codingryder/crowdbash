import { useRoomStore } from '../../store/roomStore';
import type { Room, CricketScoreData, FootballScoreData } from '../../types';
import { splitTeams } from '../../types';

interface Props {
  room: Room;
}

export function MatchHeader({ room }: Props) {
  const score = useRoomStore((s) => s.score);
  if (room.sport === 'football') return <FootballHeader room={room} score={score as FootballScoreData | null} />;
  return <CricketHeader room={room} score={score as CricketScoreData | null} />;
}

function CricketHeader({ room, score }: { room: Room; score: CricketScoreData | null }) {
  const [t1Fallback, t2Fallback] = splitTeams(room.match_name);
  const t1 = score?.team1?.name || t1Fallback;
  const t2 = score?.team2?.name || t2Fallback;
  const s1 = score?.team1?.score || '—';
  const o1 = score?.team1?.overs ? `${score.team1.overs} ov` : '—';
  const s2 = score?.team2?.score || '—';
  const o2 = score?.team2?.overs ? `${score.team2.overs} ov` : '—';
  const crr = score?.current_rate || 0;

  return (
    <div className="px-4 pt-4 pb-3" style={{ borderBottom: '1px solid var(--b1)' }}>
      <div className="font-cabinet text-[10px] font-bold tracking-[1.5px] mb-3" style={{ color: 'var(--mu)' }}>
        {room.league || room.match_format || 'Cricket'}
      </div>
      <div className="flex items-center justify-between rounded-card px-5 py-4" style={{ background: 'var(--surface2)', border: '1px solid var(--b1)' }}>
        <div className="text-center">
          <div className="font-cabinet text-[11px] font-bold tracking-[1.5px] mb-1" style={{ color: 'var(--mu)' }}>{t1.split(' ').map(w => w[0]).join('').slice(0,3).toUpperCase()}</div>
          <div className="font-cabinet text-[28px] font-black" style={{ letterSpacing: '-1px' }}>{s1}</div>
          <div className="text-[10px] mt-0.5" style={{ color: 'var(--mu)' }}>{o1}</div>
        </div>
        <div className="text-center">
          <div className="font-cabinet text-[10px] font-bold" style={{ color: 'var(--faint)' }}>vs</div>
          {crr > 0 && <div className="text-[12px] font-semibold mt-1" style={{ color: 'var(--amber)' }}>CRR {crr.toFixed(2)}</div>}
        </div>
        <div className="text-center">
          <div className="font-cabinet text-[11px] font-bold tracking-[1.5px] mb-1" style={{ color: 'var(--mu)' }}>{t2.split(' ').map(w => w[0]).join('').slice(0,3).toUpperCase()}</div>
          <div className="font-cabinet text-[28px] font-black" style={{ color: s2 === '—' ? 'var(--mu)' : 'var(--tx)' }}>{s2}</div>
          <div className="text-[10px] mt-0.5" style={{ color: 'var(--mu)' }}>{o2}</div>
        </div>
      </div>
    </div>
  );
}

function FootballHeader({ room, score }: { room: Room; score: FootballScoreData | null }) {
  const [homeFallback, awayFallback] = splitTeams(room.match_name);
  const home = score?.home?.name || homeFallback;
  const away = score?.away?.name || awayFallback;
  const hg = score?.home?.goals ?? '—';
  const ag = score?.away?.goals ?? '—';
  const mp = room.match_progress || {};
  const minute = score?.minute || (mp.minute as number) || 0;
  const half = score?.half || (mp.half as number) || 1;

  return (
    <div className="px-4 pt-4 pb-3" style={{ borderBottom: '1px solid var(--b1)' }}>
      <div className="font-cabinet text-[10px] font-bold tracking-[1.5px] mb-3" style={{ color: 'var(--mu)' }}>
        {room.league || 'Football'}
      </div>
      <div className="flex items-center justify-between rounded-card px-5 py-4" style={{ background: 'var(--surface2)', border: '1px solid var(--b1)' }}>
        <div className="text-center flex-1">
          <div className="font-cabinet text-[11px] font-bold tracking-[1.5px] mb-1" style={{ color: 'var(--mu)' }}>{home.split(' ').map(w => w[0]).join('').slice(0,3).toUpperCase()}</div>
          <div className="font-cabinet text-[28px] font-black">{hg}</div>
        </div>
        <div className="text-center px-3">
          {minute > 0 ? (
            <>
              <div className="font-cabinet text-[14px] font-bold" style={{ color: 'var(--amber)' }}>{minute}'</div>
              <div className="text-[9px]" style={{ color: 'var(--mu)' }}>{half === 1 ? '1H' : '2H'}</div>
            </>
          ) : (
            <div className="font-cabinet text-[10px] font-bold" style={{ color: 'var(--faint)' }}>vs</div>
          )}
        </div>
        <div className="text-center flex-1">
          <div className="font-cabinet text-[11px] font-bold tracking-[1.5px] mb-1" style={{ color: 'var(--mu)' }}>{away.split(' ').map(w => w[0]).join('').slice(0,3).toUpperCase()}</div>
          <div className="font-cabinet text-[28px] font-black">{ag}</div>
        </div>
      </div>
    </div>
  );
}
