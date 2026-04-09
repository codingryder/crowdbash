import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import type { SquadPlayer } from '../../types';

type Step = 'select' | 'allocate';

const ROLE_BADGES: Record<string, { label: string; bg: string; color: string }> = {
  batsman: { label: 'BAT', bg: 'rgba(74,158,255,0.1)', color: 'var(--blue)' },
  bowler: { label: 'BOWL', bg: 'rgba(61,214,140,0.1)', color: 'var(--green)' },
  'all-rounder': { label: 'AR', bg: 'rgba(139,111,255,0.1)', color: 'var(--purple)' },
  'wicket-keeper': { label: 'WK', bg: 'rgba(244,185,64,0.12)', color: 'var(--gold)' },
};

const AVATAR_COLORS = [
  { bg: 'rgba(74,158,255,0.15)', color: 'var(--blue)' },
  { bg: 'rgba(244,185,64,0.12)', color: 'var(--gold)' },
  { bg: 'rgba(61,214,140,0.1)', color: 'var(--green)' },
  { bg: 'rgba(139,111,255,0.12)', color: 'var(--purple)' },
  { bg: 'rgba(240,90,90,0.1)', color: 'var(--red)' },
];

interface TeamBuilderModalProps {
  roomName: string;
  onSelectSquad: (playerIds: string[]) => Promise<void>;
  onSaveWeightages: (weightages: Array<{ player_id: string; weightage: number }>) => Promise<void>;
  onLockSquad: () => Promise<void>;
  onClose: () => void;
}

export function TeamBuilderModal({
  roomName,
  onSelectSquad,
  onSaveWeightages,
  onLockSquad,
  onClose,
}: TeamBuilderModalProps) {
  const availableSquads = useGameStore((s) => s.availableSquads);
  const selectedPlayerIds = useGameStore((s) => s.selectedPlayerIds);
  const game = useGameStore((s) => s.game);
  const togglePlayer = useGameStore((s) => s.togglePlayer);
  const remainingBudget = useGameStore((s) => s.remainingBudget);
  const updateWeightage = useGameStore((s) => s.updateWeightage);
  const canIncrease = useGameStore((s) => s.canIncrease);
  const canDecrease = useGameStore((s) => s.canDecrease);

  const hasSelected = game && game.player_weightages.filter((pw) => pw.selected).length === 11;
  const [step, setStep] = useState<Step>(hasSelected ? 'allocate' : 'select');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const teams = Object.entries(availableSquads);
  const count = selectedPlayerIds.length;
  const totalBudget = game?.total_budget || 50;
  const usedBudget = totalBudget - remainingBudget;

  // Get all available players in a flat list for lookup
  const allPlayers: Record<string, SquadPlayer> = {};
  for (const [, players] of teams) {
    for (const p of players as SquadPlayer[]) {
      allPlayers[p.player_id] = p;
    }
  }

  async function handleConfirmSquad() {
    if (count !== 11) return;
    setLoading(true);
    setError('');
    try {
      await onSelectSquad(selectedPlayerIds);
      setStep('allocate');
    } catch (err: unknown) {
      setError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed to save squad');
    } finally {
      setLoading(false);
    }
  }

  async function handleLock() {
    if (remainingBudget !== 0) return;
    setLoading(true);
    setError('');
    try {
      const weightages = (game?.player_weightages || [])
        .filter((pw) => pw.selected)
        .map((pw) => ({ player_id: pw.player_id, weightage: pw.weightage }));
      await onSaveWeightages(weightages);
      // Only lock if not already locked
      if (!game?.squad_locked) {
        await onLockSquad();
      }
      onClose();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed to save');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'var(--bg)' }}
    >
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-6 h-14 shrink-0"
        style={{ borderBottom: '0.5px solid var(--b1)' }}
      >
        <div>
          <span className="font-syne text-lg font-bold" style={{ color: 'var(--gold)' }}>
            {step === 'select' ? 'Build Your XI' : 'Allocate Weightage'}
          </span>
          <span className="text-[12px] ml-3" style={{ color: 'var(--mu)' }}>
            {roomName}
          </span>
        </div>
        <div className="flex items-center gap-4">
          {step === 'select' && (
            <span
              className="text-[13px] font-bold px-3 py-1 rounded-lg"
              style={{
                background: count === 11 ? 'rgba(61,214,140,0.1)' : 'var(--s2)',
                color: count === 11 ? 'var(--green)' : 'var(--gold)',
              }}
            >
              {count}/11 selected
            </span>
          )}
          {step === 'allocate' && (
            <span
              className="text-[13px] font-bold px-3 py-1 rounded-lg"
              style={{
                background: remainingBudget === 0 ? 'rgba(61,214,140,0.1)' : 'rgba(244,185,64,0.1)',
                color: remainingBudget === 0 ? 'var(--green)' : 'var(--gold)',
              }}
            >
              {usedBudget}/{totalBudget} allocated
            </span>
          )}
          <button
            onClick={onClose}
            className="text-lg cursor-pointer bg-transparent border-none px-2"
            style={{ color: 'var(--mu)' }}
          >
            ✕
          </button>
        </div>
      </div>

      {error && (
        <div className="text-[12px] px-6 py-2" style={{ background: 'rgba(240,90,90,0.1)', color: 'var(--red)' }}>
          {error}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {step === 'select' ? (
          <SelectStep
            teams={teams}
            selectedPlayerIds={selectedPlayerIds}
            togglePlayer={togglePlayer}
            canSelectMore={count < 11}
            allPlayers={allPlayers}
          />
        ) : (
          <AllocateStep
            game={game}
            remainingBudget={remainingBudget}
            totalBudget={totalBudget}
            updateWeightage={updateWeightage}
            canIncrease={canIncrease}
            canDecrease={canDecrease}
          />
        )}
      </div>

      {/* Bottom bar */}
      <div
        className="flex items-center justify-between px-6 py-3 shrink-0"
        style={{ borderTop: '0.5px solid var(--b1)', background: 'var(--s1)' }}
      >
        {step === 'select' ? (
          <>
            {/* Selected player chips */}
            <div className="flex gap-1 flex-wrap flex-1 mr-4">
              {selectedPlayerIds.slice(0, 11).map((id) => {
                const p = allPlayers[id];
                return p ? (
                  <span
                    key={id}
                    className="text-[10px] px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(244,185,64,0.1)', color: 'var(--gold)', border: '0.5px solid rgba(244,185,64,0.3)' }}
                  >
                    {p.player_name.split(' ').pop()}
                  </span>
                ) : null;
              })}
            </div>
            <button
              onClick={handleConfirmSquad}
              disabled={count !== 11 || loading}
              className="px-6 py-2.5 rounded-lg text-[13px] font-bold cursor-pointer font-syne border-none disabled:opacity-30 shrink-0"
              style={{ background: 'var(--gold)', color: '#09090F' }}
            >
              {loading ? 'Saving...' : 'Save Team & Allocate Points →'}
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setStep('select')}
              className="px-4 py-2 rounded-lg text-[12px] cursor-pointer border-none"
              style={{ background: 'var(--s2)', color: 'var(--tx)', border: '0.5px solid var(--b2)' }}
            >
              ← Back to Squad
            </button>
            <button
              onClick={handleLock}
              disabled={remainingBudget !== 0 || loading}
              className="px-6 py-2.5 rounded-lg text-[13px] font-bold cursor-pointer font-syne border-none disabled:opacity-30"
              style={{ background: 'var(--gold)', color: '#09090F' }}
            >
              {loading ? 'Saving...' : remainingBudget === 0 ? (game?.squad_locked ? '✅ Save Weightages' : '🔒 Lock & Start Playing') : `Allocate ${remainingBudget} more points`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Step 1: Squad Selection ──

function SelectStep({
  teams,
  selectedPlayerIds,
  togglePlayer,
  canSelectMore,
  allPlayers: _allPlayers,
}: {
  teams: [string, SquadPlayer[]][];
  selectedPlayerIds: string[];
  togglePlayer: (id: string) => void;
  canSelectMore: boolean;
  allPlayers: Record<string, SquadPlayer>;
}) {
  return (
    <div className="grid grid-cols-2 gap-0" style={{ minHeight: '100%' }}>
      {teams.map(([teamName, players], teamIdx) => (
        <div
          key={teamName}
          className="px-5 py-4"
          style={{ borderRight: teamIdx === 0 ? '0.5px solid var(--b1)' : 'none' }}
        >
          <div className="font-syne text-[14px] font-bold mb-1" style={{ color: 'var(--tx)' }}>
            {teamName}
          </div>
          <div className="text-[11px] mb-3" style={{ color: 'var(--mu)' }}>
            {(players as SquadPlayer[]).length} players
          </div>

          {(players as SquadPlayer[]).map((player) => {
            const isSelected = selectedPlayerIds.includes(player.player_id);
            const badge = ROLE_BADGES[(player.player_role || '').toLowerCase()] || { label: '?', bg: 'var(--s2)', color: 'var(--mu)' };

            return (
              <button
                key={player.player_id}
                onClick={() => togglePlayer(player.player_id)}
                disabled={!isSelected && !canSelectMore}
                className="w-full flex items-center gap-3 rounded-xl mb-2 text-left border-none cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed transition-all"
                style={{
                  background: isSelected ? 'rgba(244,185,64,0.06)' : 'var(--s1)',
                  border: isSelected ? '1.5px solid var(--gold)' : '0.5px solid var(--b1)',
                  padding: '10px 12px',
                }}
              >
                {/* Checkbox */}
                <div
                  className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 text-[11px] font-bold"
                  style={{
                    background: isSelected ? 'var(--gold)' : 'transparent',
                    color: isSelected ? '#09090F' : 'transparent',
                    border: isSelected ? 'none' : '1.5px solid var(--b2)',
                  }}
                >
                  {isSelected ? '✓' : ''}
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium" style={{ color: isSelected ? 'var(--tx)' : 'var(--mu)' }}>
                    {player.player_name}
                  </div>
                </div>

                {/* Role badge */}
                <span
                  className="text-[9px] font-semibold px-2 py-0.5 rounded shrink-0"
                  style={{ background: badge.bg, color: badge.color }}
                >
                  {badge.label}
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── Step 2: Weightage Allocation ──

function AllocateStep({
  game,
  remainingBudget,
  totalBudget,
  updateWeightage,
  canIncrease,
  canDecrease,
}: {
  game: ReturnType<typeof useGameStore.getState>['game'];
  remainingBudget: number;
  totalBudget: number;
  updateWeightage: (id: string, delta: number) => void;
  canIncrease: (id: string) => boolean;
  canDecrease: (id: string) => boolean;
}) {
  if (!game) return null;

  const selectedPlayers = game.player_weightages.filter((pw) => pw.selected);
  const usedBudget = totalBudget - remainingBudget;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 32px' }}>
      {/* Budget bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[13px]" style={{ color: 'var(--mu)' }}>
            Distribute <strong style={{ color: 'var(--gold)' }}>{totalBudget}</strong> points across your 11 players
          </span>
          <span className="font-syne text-xl font-extrabold" style={{ color: 'var(--gold)' }}>
            {remainingBudget} left
          </span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--s3)' }}>
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${(usedBudget / totalBudget) * 100}%`,
              background: remainingBudget === 0 ? 'var(--green)' : 'var(--gold)',
            }}
          />
        </div>
      </div>

      {/* Player grid */}
      <div className="grid grid-cols-3 gap-3">
        {selectedPlayers.map((player, i) => {
          const avStyle = AVATAR_COLORS[i % AVATAR_COLORS.length];
          const initials = player.player_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
          const badge = ROLE_BADGES[(player.player_role || '').toLowerCase()] || { label: '?', bg: 'var(--s2)', color: 'var(--mu)' };

          return (
            <div
              key={player.player_id}
              className="rounded-xl p-4"
              style={{
                background: 'var(--s1)',
                border: player.weightage > 0 ? '1px solid rgba(244,185,64,0.3)' : '0.5px solid var(--b1)',
              }}
            >
              {/* Player info */}
              <div className="flex items-center gap-2.5 mb-3">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                  style={{ background: avStyle.bg, color: avStyle.color }}
                >
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium truncate" style={{ color: 'var(--tx)' }}>
                    {player.player_name}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px]" style={{ color: 'var(--mu)' }}>{player.team}</span>
                    <span
                      className="text-[8px] font-semibold px-1.5 py-px rounded"
                      style={{ background: badge.bg, color: badge.color }}
                    >
                      {badge.label}
                    </span>
                  </div>
                </div>
              </div>

              {/* Weightage control */}
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => updateWeightage(player.player_id, -1)}
                  disabled={!canDecrease(player.player_id)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-base font-bold cursor-pointer transition-all border-none disabled:opacity-20"
                  style={{ background: 'var(--s2)', color: 'var(--tx)' }}
                >
                  −
                </button>
                <div
                  className="font-syne text-2xl font-extrabold min-w-[32px] text-center"
                  style={{ color: player.weightage > 0 ? 'var(--gold)' : 'var(--dm)' }}
                >
                  {player.weightage}
                </div>
                <button
                  onClick={() => updateWeightage(player.player_id, 1)}
                  disabled={!canIncrease(player.player_id)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-base font-bold cursor-pointer transition-all border-none disabled:opacity-20"
                  style={{ background: 'var(--s2)', color: 'var(--tx)' }}
                >
                  +
                </button>
              </div>

              {/* Points earned */}
              {player.points_earned > 0 && (
                <div className="text-center mt-2 text-[11px]" style={{ color: 'var(--green)' }}>
                  +{player.points_earned} pts
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
