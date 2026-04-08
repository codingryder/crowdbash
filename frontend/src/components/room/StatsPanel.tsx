import { useGameStore } from '../../store/gameStore';

export function StatsPanel() {
  const leaderboard = useGameStore((s) => s.leaderboard);

  return (
    <div className="bg-surface2 rounded-xl border border-white/[0.07] p-4">
      <h3 className="font-syne font-semibold text-sm mb-3">Leaderboard</h3>

      {leaderboard.length === 0 ? (
        <p className="text-xs text-white/30 text-center py-4">
          No players yet. Join the game!
        </p>
      ) : (
        <div className="space-y-2">
          {leaderboard.slice(0, 10).map((entry, i) => (
            <div
              key={entry.user_id}
              className="flex items-center justify-between px-3 py-2 rounded-lg bg-surface3"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-bold w-5 ${
                    i === 0 ? 'text-gold' : i === 1 ? 'text-white/70' : i === 2 ? 'text-fanblue' : 'text-white/40'
                  }`}
                >
                  #{i + 1}
                </span>
                <span className="text-sm">{entry.username}</span>
              </div>
              <span className="text-sm font-semibold text-gold">{entry.points}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
