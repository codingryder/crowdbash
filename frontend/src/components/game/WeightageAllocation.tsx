import { useGameStore } from '../../store/gameStore';

const AVATAR_COLORS = [
  { bg: 'rgba(74,158,255,0.15)', color: 'var(--blue)' },
  { bg: 'rgba(244,185,64,0.12)', color: 'var(--gold)' },
  { bg: 'rgba(61,214,140,0.1)', color: 'var(--green)' },
  { bg: 'rgba(139,111,255,0.12)', color: 'var(--purple)' },
  { bg: 'rgba(240,90,90,0.1)', color: 'var(--red)' },
];

interface WeightageAllocationProps {
  onSave: (weightages: Array<{ player_id: string; weightage: number }>) => void;
  onLock: () => void;
  isLocked: boolean;
}

export function WeightageAllocation({ onSave, onLock, isLocked }: WeightageAllocationProps) {
  const game = useGameStore((s) => s.game);
  const remainingBudget = useGameStore((s) => s.remainingBudget);
  const updateWeightage = useGameStore((s) => s.updateWeightage);
  const canIncrease = useGameStore((s) => s.canIncrease);
  const canDecrease = useGameStore((s) => s.canDecrease);

  if (!game) return null;

  const selectedPlayers = game.player_weightages.filter((pw) => pw.selected);
  const totalBudget = game.total_budget || 50;
  const usedBudget = totalBudget - remainingBudget;
  const isFullyAllocated = remainingBudget === 0;

  function handleSave() {
    const weightages = selectedPlayers.map((pw) => ({
      player_id: pw.player_id,
      weightage: pw.weightage,
    }));
    onSave(weightages);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Budget header */}
      <div
        className="px-4 py-3 shrink-0"
        style={{ background: 'rgba(244,185,64,0.05)', borderBottom: '0.5px solid var(--b1)' }}
      >
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="font-syne text-sm font-bold" style={{ color: 'var(--gold)' }}>
              {isLocked ? '🔒 Squad Locked' : 'Allocate Weightage'}
            </div>
            <div className="text-[10px] mt-0.5" style={{ color: 'var(--mu)' }}>
              {isLocked
                ? `Total: ${totalBudget} points allocated`
                : `Distribute ${totalBudget} points across your 11 players`}
            </div>
          </div>
          <div className="text-right">
            <div className="font-syne text-xl font-extrabold" style={{ color: 'var(--gold)' }}>
              {remainingBudget}
            </div>
            <div className="text-[9px]" style={{ color: 'rgba(244,185,64,0.5)' }}>remaining</div>
          </div>
        </div>

        {/* Budget bar */}
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--s3)' }}>
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${(usedBudget / totalBudget) * 100}%`,
              background: isFullyAllocated ? 'var(--green)' : 'var(--gold)',
            }}
          />
        </div>
      </div>

      {/* Player list */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        <div className="text-[9px] uppercase tracking-[1px] mb-2" style={{ color: 'var(--mu)' }}>
          Your XI ({selectedPlayers.length} players)
        </div>

        {selectedPlayers.map((player, i) => {
          const avStyle = AVATAR_COLORS[i % AVATAR_COLORS.length];
          const initials = player.player_name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .slice(0, 2)
            .toUpperCase();

          return (
            <div
              key={player.player_id}
              className="flex items-center gap-2.5 rounded-[10px] mb-[6px]"
              style={{ background: 'var(--s1)', border: '0.5px solid var(--b1)', padding: '8px 10px' }}
            >
              {/* Avatar */}
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                style={{ background: avStyle.bg, color: avStyle.color }}
              >
                {initials}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-medium truncate" style={{ color: 'var(--tx)' }}>
                  {player.player_name}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px]" style={{ color: 'var(--mu)' }}>{player.team}</span>
                  {player.player_role && (
                    <span className="text-[9px] capitalize" style={{ color: 'var(--dm)' }}>
                      {player.player_role}
                    </span>
                  )}
                </div>
                {player.points_earned > 0 && (
                  <div className="text-[10px] mt-0.5" style={{ color: 'var(--green)' }}>
                    +{player.points_earned} pts
                  </div>
                )}
              </div>

              {/* Weightage controls */}
              {!isLocked ? (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => updateWeightage(player.player_id, -1)}
                    disabled={!canDecrease(player.player_id)}
                    className="w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium cursor-pointer transition-all border-none disabled:opacity-20"
                    style={{ background: 'var(--s2)', color: 'var(--tx)' }}
                  >
                    −
                  </button>
                  <div
                    className="font-syne text-[14px] font-bold min-w-[20px] text-center"
                    style={{ color: player.weightage > 0 ? 'var(--gold)' : 'var(--dm)' }}
                  >
                    {player.weightage}
                  </div>
                  <button
                    onClick={() => updateWeightage(player.player_id, 1)}
                    disabled={!canIncrease(player.player_id)}
                    className="w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium cursor-pointer transition-all border-none disabled:opacity-20"
                    style={{ background: 'var(--s2)', color: 'var(--tx)' }}
                  >
                    +
                  </button>
                </div>
              ) : (
                <div className="font-syne text-[14px] font-bold" style={{ color: 'var(--gold)' }}>
                  {player.weightage}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Action buttons */}
      {!isLocked && (
        <div className="px-3 py-3 shrink-0 space-y-2" style={{ borderTop: '0.5px solid var(--b1)' }}>
          <button
            onClick={handleSave}
            className="w-full py-2 rounded-lg text-[12px] font-semibold cursor-pointer font-syne border-none"
            style={{ background: 'var(--s2)', color: 'var(--tx)', border: '0.5px solid var(--b2)' }}
          >
            Save Weightages
          </button>
          <button
            onClick={onLock}
            disabled={!isFullyAllocated}
            className="w-full py-2.5 rounded-lg text-[13px] font-bold cursor-pointer font-syne border-none disabled:opacity-30"
            style={{ background: 'var(--gold)', color: '#09090F' }}
          >
            {isFullyAllocated ? '🔒 Lock Squad & Start Playing' : `Allocate ${remainingBudget} more points`}
          </button>
        </div>
      )}
    </div>
  );
}
