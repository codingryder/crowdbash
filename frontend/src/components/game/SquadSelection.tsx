import { useGameStore } from '../../store/gameStore';
import type { SquadPlayer } from '../../types';
import { usePlayingXi } from '../../hooks/usePlayingXi';
import { useIsMobile } from '../../hooks/useIsMobile';
import { XiStatusBadge } from './XiStatusBadge';

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  batsman: { bg: 'rgba(74,158,255,0.1)', color: 'var(--blue)' },
  bowler: { bg: 'rgba(61,214,140,0.1)', color: 'var(--green)' },
  'all-rounder': { bg: 'rgba(139,111,255,0.1)', color: 'var(--purple)' },
  'wicket-keeper': { bg: 'rgba(244,185,64,0.12)', color: 'var(--gold)' },
};

interface SquadSelectionProps {
  onConfirm: (playerIds: string[]) => void;
}

export function SquadSelection({ onConfirm }: SquadSelectionProps) {
  const availableSquads = useGameStore((s) => s.availableSquads);
  const selectedPlayerIds = useGameStore((s) => s.selectedPlayerIds);
  const togglePlayer = useGameStore((s) => s.togglePlayer);
  const canSelectMore = useGameStore((s) => s.canSelectMore);
  const getSelectedCount = useGameStore((s) => s.getSelectedCount);
  const { announced, isInXi } = usePlayingXi();
  const isMobile = useIsMobile();

  const count = getSelectedCount();
  const teams = Object.entries(availableSquads);

  if (teams.length === 0) {
    return (
      <div className="p-6 text-center">
        <div className="text-2xl mb-3">🏏</div>
        <div className="font-syne text-sm font-bold mb-2" style={{ color: 'var(--tx)' }}>
          Squad not available yet
        </div>
        <div className="text-[11px]" style={{ color: 'var(--mu)' }}>
          Squads will be added before the match starts
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 shrink-0" style={{ borderBottom: '0.5px solid var(--b1)' }}>
        <div className="font-syne text-sm font-bold mb-1" style={{ color: 'var(--gold)' }}>
          Build Your XI
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px]" style={{ color: 'var(--mu)' }}>
            Select 11 players from both squads
          </span>
          <span
            className="text-[12px] font-bold px-2 py-0.5 rounded-lg"
            style={{
              background: count === 11 ? 'rgba(61,214,140,0.1)' : 'var(--s2)',
              color: count === 11 ? 'var(--green)' : 'var(--gold)',
            }}
          >
            {count}/11
          </span>
        </div>
      </div>

      {/* Player lists */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {teams.map(([teamName, players]) => (
          <div key={teamName} className="mb-4">
            <div className="text-[10px] uppercase tracking-[1px] mb-2 px-1" style={{ color: 'var(--mu)' }}>
              {teamName}
            </div>
            {(players as SquadPlayer[]).map((player) => {
              const isSelected = selectedPlayerIds.includes(player.player_id);
              const canAdd = canSelectMore();
              const roleStyle = ROLE_COLORS[player.player_role?.toLowerCase()] || { bg: 'var(--s2)', color: 'var(--mu)' };

              return (
                <button
                  key={player.player_id}
                  onClick={() => togglePlayer(player.player_id)}
                  disabled={!isSelected && !canAdd}
                  className="w-full flex items-center gap-2.5 rounded-[10px] mb-[6px] text-left border-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  style={{
                    background: isSelected ? 'rgba(244,185,64,0.06)' : 'var(--s1)',
                    border: isSelected ? '1px solid var(--gold)' : '0.5px solid var(--b1)',
                    padding: '8px 10px',
                  }}
                >
                  {/* Checkbox */}
                  <div
                    className="w-5 h-5 rounded flex items-center justify-center shrink-0 text-[10px]"
                    style={{
                      background: isSelected ? 'var(--gold)' : 'var(--s2)',
                      color: isSelected ? '#09090F' : 'transparent',
                      border: isSelected ? 'none' : '1px solid var(--b2)',
                    }}
                  >
                    {isSelected ? '✓' : ''}
                  </div>

                  {/* Player info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-medium truncate flex items-center gap-1.5" style={{ color: 'var(--tx)' }}>
                      <span className="truncate">{player.player_name}</span>
                      {announced && <XiStatusBadge inXi={isInXi(player.player_name)} />}
                    </div>
                    <div className="text-[10px]" style={{ color: 'var(--mu)' }}>
                      {player.team}
                    </div>
                  </div>

                  {/* Role badge */}
                  {player.player_role && (
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded shrink-0 capitalize"
                      style={{ background: roleStyle.bg, color: roleStyle.color }}
                    >
                      {player.player_role}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Confirm button */}
      <div className="px-3 py-3 shrink-0" style={{ borderTop: '0.5px solid var(--b1)' }}>
        <button
          onClick={() => onConfirm(selectedPlayerIds)}
          disabled={count !== 11}
          className="w-full py-2.5 rounded-lg text-[13px] font-bold cursor-pointer font-syne border-none disabled:opacity-30"
          style={{ background: 'var(--gold)', color: '#09090F' }}
        >
          {count === 11 ? 'Confirm Squad & Allocate Points →' : `Select ${11 - count} more player${11 - count !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  );
}
