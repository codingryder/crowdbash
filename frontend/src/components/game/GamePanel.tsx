import { useGameStore } from '../../store/gameStore';
import { GameScoreHeader } from './GameScoreHeader';
import { PlayerCard } from './PlayerCard';
import { WeightageShop } from './WeightageShop';

interface GamePanelProps {
  roomId: string;
}

export function GamePanel({ roomId }: GamePanelProps) {
  const game = useGameStore((s) => s.game);
  const editWindowOpen = useGameStore((s) => s.editWindowOpen);
  const updateWeightage = useGameStore((s) => s.updateWeightage);
  const canIncrease = useGameStore((s) => s.canIncrease);
  const canDecrease = useGameStore((s) => s.canDecrease);

  if (!game) {
    return (
      <div className="bg-surface2 rounded-xl border border-white/[0.07] p-6 text-center">
        <h3 className="font-syne font-semibold text-sm mb-2">Weightage Game</h3>
        <p className="text-xs text-white/40">Join the game to start playing!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <GameScoreHeader />

      {/* Edit window indicator */}
      {editWindowOpen && (
        <div className="bg-gold/10 border border-gold/30 rounded-lg px-3 py-2 text-center">
          <p className="text-xs text-gold font-semibold">
            Edit window open! Adjust your weightages now.
          </p>
        </div>
      )}

      {/* Player cards */}
      <div className="space-y-2">
        {game.player_weightages.map((pw) => (
          <PlayerCard
            key={pw.player_id}
            player={pw}
            canEdit={editWindowOpen}
            onWeightageChange={updateWeightage}
            canIncrease={canIncrease(pw.player_id)}
            canDecrease={canDecrease(pw.player_id)}
          />
        ))}
      </div>

      <WeightageShop roomId={roomId} />
    </div>
  );
}
