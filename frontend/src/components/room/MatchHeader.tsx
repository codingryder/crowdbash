import { useRoomStore } from '../../store/roomStore';
import type { Room, CricketScoreData, FootballScoreData } from '../../types';

interface MatchHeaderProps {
  room: Room;
}

export function MatchHeader({ room }: MatchHeaderProps) {
  const score = useRoomStore((s) => s.score);

  if (room.sport === 'football') {
    return <FootballMatchHeader room={room} score={score as FootballScoreData | null} />;
  }
  return <CricketMatchHeader room={room} score={score as CricketScoreData | null} />;
}

function CricketMatchHeader({ room, score }: { room: Room; score: CricketScoreData | null }) {
  // Parse team names from room.match_name "Team A vs Team B"
  const parts = room.match_name.split(' vs ');
  const team1Name = score?.team1?.name || parts[0]?.trim() || 'TBD';
  const team2Name = score?.team2?.name || parts[1]?.trim() || 'TBD';
  const team1Score = score?.team1?.score || '\u2014';
  const team1Overs = score?.team1?.overs ? `${score.team1.overs} ov` : '\u2014';
  const team2Score = score?.team2?.score || '\u2014';
  const team2Overs = score?.team2?.overs ? `${score.team2.overs} ov` : '\u2014';
  const crr = score?.current_rate || 0;
  const over = room.current_over || 0;

  return (
    <div style={{ padding: '16px 16px 12px', borderBottom: '0.5px solid var(--b1)' }}>
      <div className="text-[10px] uppercase tracking-[1px] mb-2" style={{ color: 'var(--mu)' }}>
        {room.league || room.match_format || 'Cricket'} {over > 0 ? `\u00b7 Over ${over}` : ''}
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
          { label: 'Status', value: room.status === 'live' ? 'Live' : room.status },
          { label: 'Format', value: room.match_format || '\u2014' },
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

function FootballMatchHeader({ room, score }: { room: Room; score: FootballScoreData | null }) {
  const parts = room.match_name.split(' vs ');
  const homeName = score?.home?.name || parts[0]?.trim() || 'Home';
  const awayName = score?.away?.name || parts[1]?.trim() || 'Away';
  const homeGoals = score?.home?.goals ?? '\u2014';
  const awayGoals = score?.away?.goals ?? '\u2014';
  const mp = room.match_progress || {};
  const minute = score?.minute || (mp.minute as number) || 0;
  const half = score?.half || (mp.half as number) || 1;

  return (
    <div style={{ padding: '16px 16px 12px', borderBottom: '0.5px solid var(--b1)' }}>
      <div className="text-[10px] uppercase tracking-[1px] mb-2" style={{ color: 'var(--mu)' }}>
        {room.league || 'Football'} {minute > 0 ? `\u00b7 ${minute}\u2019` : ''}
      </div>
      <div className="flex items-center justify-between">
        <div className="text-center flex-1">
          <div className="font-syne text-[11px] font-bold" style={{ color: 'var(--mu)' }}>{homeName}</div>
          <div className="font-syne text-2xl font-extrabold leading-none mt-0.5" style={{ color: 'var(--tx)' }}>{homeGoals}</div>
        </div>
        <div className="px-3 text-center">
          <div className="font-syne text-sm font-bold" style={{ color: 'var(--gold)' }}>
            {minute > 0 ? `${minute}\u2019` : 'vs'}
          </div>
          {minute > 0 && (
            <div className="text-[9px]" style={{ color: 'var(--mu)' }}>{half === 1 ? '1H' : '2H'}</div>
          )}
        </div>
        <div className="text-center flex-1">
          <div className="font-syne text-[11px] font-bold" style={{ color: 'var(--mu)' }}>{awayName}</div>
          <div className="font-syne text-2xl font-extrabold leading-none mt-0.5" style={{ color: 'var(--tx)' }}>{awayGoals}</div>
        </div>
      </div>
      <div className="flex justify-between mt-2.5">
        {[
          { label: 'Status', value: room.status === 'live' ? 'Live' : room.status },
          { label: 'Half', value: minute > 0 ? (half === 1 ? '1st' : '2nd') : '\u2014' },
          { label: 'League', value: room.league || '\u2014' },
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
