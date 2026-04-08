import { useRoomStore } from '../../store/roomStore';

export function MatchHeader() {
  const score = useRoomStore((s) => s.score);

  // Placeholder data when no live score
  const team1Name = score?.team1?.name || 'IND';
  const team1Score = score?.team1?.score || '—';
  const team1Overs = score?.team1?.overs ? `${score.team1.overs} ov` : '—';
  const team2Name = score?.team2?.name || 'AUS';
  const team2Score = score?.team2?.score || '—';
  const team2Overs = score?.team2?.overs ? `${score.team2.overs} ov` : '—';
  const crr = score?.current_rate || 0;

  return (
    <div style={{ padding: '16px 16px 12px', borderBottom: '0.5px solid var(--b1)' }}>
      <div
        className="text-[10px] uppercase tracking-[1px] mb-2"
        style={{ color: 'var(--mu)' }}
      >
        Live Match
      </div>

      {/* Teams */}
      <div className="flex items-center justify-between">
        <div className="text-center">
          <div className="font-syne text-[11px] font-bold" style={{ color: 'var(--mu)' }}>
            {team1Name}
          </div>
          <div className="font-syne text-xl font-extrabold leading-none mt-0.5" style={{ color: 'var(--tx)' }}>
            {team1Score}
          </div>
          <div className="text-[10px] mt-0.5" style={{ color: 'var(--mu)' }}>
            {team1Overs}
          </div>
        </div>

        <div className="text-base" style={{ color: 'var(--dm)' }}>/</div>

        <div className="text-center">
          <div className="font-syne text-[11px] font-bold" style={{ color: 'var(--mu)' }}>
            {team2Name}
          </div>
          <div className="font-syne text-xl font-extrabold leading-none mt-0.5" style={{ color: 'var(--tx)' }}>
            {team2Score}
          </div>
          <div className="text-[10px] mt-0.5" style={{ color: 'var(--mu)' }}>
            {team2Overs}
          </div>
        </div>
      </div>

      {/* Meta row */}
      <div className="flex justify-between mt-2.5">
        {[
          { label: 'CRR', value: crr > 0 ? crr.toFixed(2) : '—' },
          { label: 'Last 5', value: '—' },
          { label: "P'ship", value: '—' },
        ].map((item) => (
          <div key={item.label} className="text-center">
            <div
              className="text-[9px] uppercase tracking-[0.5px]"
              style={{ color: 'var(--mu)' }}
            >
              {item.label}
            </div>
            <div
              className="text-xs font-medium mt-0.5"
              style={{ color: 'var(--gold)' }}
            >
              {item.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
