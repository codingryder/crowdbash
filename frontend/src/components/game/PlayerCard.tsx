import type { PlayerWeightage } from '../../types';
import { WeightageControl } from './WeightageControl';

interface PlayerCardProps {
  player: PlayerWeightage;
  canEdit: boolean;
  onWeightageChange: (playerId: string, delta: number) => void;
  canIncrease: boolean;
  canDecrease: boolean;
}

export function PlayerCard({
  player,
  canEdit,
  onWeightageChange,
  canIncrease,
  canDecrease,
}: PlayerCardProps) {
  return (
    <div className="bg-surface3 rounded-lg p-3 border border-white/[0.07] flex items-center justify-between">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{player.player_name}</p>
        <p className="text-xs text-white/40">{player.team}</p>
        {player.points_earned > 0 && (
          <p className="text-xs text-fangreen mt-0.5">+{player.points_earned} pts</p>
        )}
      </div>

      <WeightageControl
        value={player.weightage}
        canEdit={canEdit}
        onIncrease={() => onWeightageChange(player.player_id, 1)}
        onDecrease={() => onWeightageChange(player.player_id, -1)}
        canIncrease={canIncrease}
        canDecrease={canDecrease}
      />
    </div>
  );
}
