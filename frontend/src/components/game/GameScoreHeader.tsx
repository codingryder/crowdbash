import { useGameStore } from '../../store/gameStore';

export function GameScoreHeader() {
  const game = useGameStore((s) => s.game);
  const remainingBudget = useGameStore((s) => s.remainingBudget);

  if (!game) return null;

  return (
    <div className="bg-surface3 rounded-xl p-4 border border-white/[0.07]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-syne font-semibold text-sm">Your Game</h3>
        <span className="text-gold font-syne font-bold text-lg">
          {game.total_points} pts
        </span>
      </div>

      {/* Budget bar */}
      <div>
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-white/50">Weightage Budget</span>
          <span className="text-gold font-medium">{remainingBudget} remaining</span>
        </div>
        <div className="h-2 bg-surface rounded-full overflow-hidden">
          <div
            className="h-full bg-gold rounded-full transition-all duration-300"
            style={{ width: `${((10 - remainingBudget) / 10) * 100}%` }}
          />
        </div>
      </div>

      {game.rank && (
        <p className="mt-2 text-xs text-white/40">
          Current rank: <span className="text-gold">#{game.rank}</span>
        </p>
      )}
    </div>
  );
}
