import { useRoomStore } from '../../store/roomStore';

export function ScoreHeader() {
  const score = useRoomStore((s) => s.score);

  if (!score) {
    return (
      <div className="bg-surface2 rounded-xl p-4 border border-white/[0.07] animate-pulse">
        <div className="h-12 bg-surface3 rounded" />
      </div>
    );
  }

  return (
    <div className="bg-surface2 rounded-xl p-4 border border-white/[0.07]">
      <div className="flex items-center justify-between">
        {/* Team 1 */}
        <div className="flex-1">
          <p className="text-xs text-white/50 uppercase tracking-wide">{score.team1.name}</p>
          <p className="font-syne font-bold text-2xl text-white mt-0.5">{score.team1.score}</p>
          <p className="text-xs text-white/40">({score.team1.overs} ov)</p>
        </div>

        {/* VS */}
        <div className="px-4">
          <span className="text-xs text-white/30 font-syne">VS</span>
        </div>

        {/* Team 2 */}
        <div className="flex-1 text-right">
          <p className="text-xs text-white/50 uppercase tracking-wide">{score.team2.name}</p>
          <p className="font-syne font-bold text-2xl text-white mt-0.5">{score.team2.score}</p>
          <p className="text-xs text-white/40">({score.team2.overs} ov)</p>
        </div>
      </div>

      {/* Status bar */}
      <div className="mt-3 pt-3 border-t border-white/[0.07] flex items-center justify-between text-xs text-white/40">
        <span>{score.status}</span>
        <span>CRR: {score.current_rate}</span>
      </div>
    </div>
  );
}
