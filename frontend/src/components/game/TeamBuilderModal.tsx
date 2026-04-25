import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import type { SquadPlayer } from '../../types';
import { PlayerAvatar } from '../ui/PlayerAvatar';

const TOTAL_POWER = 33;
const MAX_POWER = 6;
const MIN_POWER = 1;
const DEFAULT_POWER = 3;

type Step = 'pick' | 'power' | 'locked';

const ROLE_TAGS: Record<string, { label: string; color: string; bg: string }> = {
  batsman: { label: 'BAT', color: 'var(--green)', bg: 'rgba(45,214,122,0.1)' },
  bowler: { label: 'BOWL', color: 'var(--purple)', bg: 'rgba(139,92,246,0.1)' },
  'all-rounder': { label: 'AR', color: 'var(--amber)', bg: 'rgba(245,158,11,0.1)' },
  'wicket-keeper': { label: 'WK', color: 'var(--mu)', bg: 'rgba(192,194,200,0.08)' },
};

interface Props {
  roomName: string;
  onSelectSquad: (ids: string[]) => Promise<void>;
  onSaveWeightages: (w: Array<{ player_id: string; weightage: number }>) => Promise<void>;
  onLockSquad: () => Promise<void>;
  onClose: () => void;
}

export function TeamBuilderModal({ roomName: _roomName, onSelectSquad, onSaveWeightages, onLockSquad, onClose }: Props) {
  const availableSquads = useGameStore((s) => s.availableSquads);
  const selectedPlayerIds = useGameStore((s) => s.selectedPlayerIds);
  const game = useGameStore((s) => s.game);
  const togglePlayer = useGameStore((s) => s.togglePlayer);

  const hasSelected = game && game.player_weightages.filter((pw) => pw.selected).length === 11;
  const [step, setStep] = useState<Step>(hasSelected ? 'power' : 'pick');
  const [powers, setPowers] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    game?.player_weightages.forEach((pw) => {
      if (pw.selected) init[pw.player_id] = pw.weightage || DEFAULT_POWER;
    });
    return init;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [search, setSearch] = useState('');

  const teams = Object.entries(availableSquads);
  const count = selectedPlayerIds.length;

  // All players flat
  const allPlayers: SquadPlayer[] = [];
  for (const [, players] of teams) {
    for (const p of players as SquadPlayer[]) allPlayers.push(p);
  }

  // Filter for bench
  const filteredPlayers = allPlayers.filter((p) => {
    if (roleFilter !== 'all' && (p.player_role || '').toLowerCase() !== roleFilter) return false;
    if (search && !p.player_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Power calculations
  const selectedPlayers = game?.player_weightages.filter((pw) => pw.selected) || [];
  const totalUsed = Object.values(powers).reduce((s, v) => s + v, 0);
  const isBalanced = totalUsed === TOTAL_POWER;

  function setPower(playerId: string, newVal: number) {
    newVal = Math.max(MIN_POWER, Math.min(MAX_POWER, newVal));
    const updated = { ...powers, [playerId]: newVal };

    // Auto-balance: steal from highest or give to lowest
    const total = Object.values(updated).reduce((s, v) => s + v, 0);
    const diff = total - TOTAL_POWER;
    if (diff !== 0) {
      const others = Object.keys(updated).filter((k) => k !== playerId);
      let remaining = Math.abs(diff);
      if (diff > 0) {
        // Over budget — reduce others
        const sorted = others.sort((a, b) => updated[b] - updated[a]);
        for (const k of sorted) {
          if (remaining <= 0) break;
          const canTake = updated[k] - MIN_POWER;
          const take = Math.min(canTake, remaining);
          updated[k] -= take;
          remaining -= take;
        }
      } else {
        // Under budget — increase others
        const sorted = others.sort((a, b) => updated[a] - updated[b]);
        for (const k of sorted) {
          if (remaining <= 0) break;
          const canGive = MAX_POWER - updated[k];
          const give = Math.min(canGive, remaining);
          updated[k] += give;
          remaining -= give;
        }
      }
    }

    setPowers(updated);
  }

  async function handleConfirmSquad() {
    if (count !== 11) return;
    setLoading(true);
    setError('');
    try {
      await onSelectSquad(selectedPlayerIds);
      // Init powers
      const init: Record<string, number> = {};
      selectedPlayerIds.forEach((id) => { init[id] = DEFAULT_POWER; });
      setPowers(init);
      setStep('power');
    } catch (err: unknown) {
      setError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleLock() {
    if (!isBalanced) return;
    setLoading(true);
    setError('');
    try {
      const weightages = Object.entries(powers).map(([pid, w]) => ({ player_id: pid, weightage: w }));
      await onSaveWeightages(weightages);
      if (!game?.squad_locked) await onLockSquad();
      onClose();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[900] flex flex-col" style={{ background: 'var(--bg)', paddingTop: 60 }}>
      {/* Step bar */}
      <div
        className="h-[52px] flex items-center justify-between px-4 md:px-6 shrink-0"
        style={{ borderBottom: '1px solid var(--b1)', background: 'var(--bg2)' }}
      >
        <div className="flex items-center gap-0">
          {['Pick your 11', 'Assign power', 'Lock in'].map((label, i) => (
            <div key={label} className="flex items-center">
              {i > 0 && <span className="text-[13px] mx-1" style={{ color: 'var(--faint)' }}>›</span>}
              <div
                className="flex items-center gap-1.5 px-3 text-[12px] font-semibold"
                style={{ color: step === ['pick', 'power', 'locked'][i] ? 'var(--green)' : 'var(--mu)' }}
              >
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center font-cabinet text-[9px] font-extrabold shrink-0"
                  style={{
                    border: step === ['pick', 'power', 'locked'][i] ? 'none' : '1.5px solid currentColor',
                    background: step === ['pick', 'power', 'locked'][i] ? 'var(--green)' : 'transparent',
                    color: step === ['pick', 'power', 'locked'][i] ? '#071a0e' : 'inherit',
                  }}
                >
                  {i + 1}
                </div>
                <span className="hidden md:inline">{label}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <div className="text-[12px]" style={{ color: 'var(--mu)' }}>
            {step === 'pick' && <><span className="font-cabinet font-bold" style={{ color: 'var(--green)' }}>{count}</span>/11 picked</>}
            {step === 'power' && <><span className="font-cabinet font-bold" style={{ color: isBalanced ? 'var(--green)' : 'var(--amber)' }}>{totalUsed}</span>/33 power</>}
          </div>
          {step === 'pick' && (
            <button
              onClick={handleConfirmSquad}
              disabled={count !== 11 || loading}
              className="font-cabinet text-[13px] font-extrabold border-none rounded-[8px] px-5 py-2 transition-all disabled:opacity-30"
              style={{ background: 'var(--green)', color: '#071a0e' }}
            >
              {loading ? 'Saving...' : 'Assign Power →'}
            </button>
          )}
          {step === 'power' && (
            <button
              onClick={handleLock}
              disabled={!isBalanced || loading}
              className="font-cabinet text-[13px] font-extrabold border-none rounded-[8px] px-5 py-2 transition-all disabled:opacity-30"
              style={{ background: 'var(--green)', color: '#071a0e' }}
            >
              {loading ? 'Locking...' : game?.squad_locked ? 'Save changes →' : 'Lock in & play →'}
            </button>
          )}
          <button onClick={onClose} className="text-[18px] bg-transparent border-none px-2" style={{ color: 'var(--mu)' }}>×</button>
        </div>
      </div>

      {error && (
        <div className="text-[12px] px-6 py-2" style={{ background: 'rgba(240,82,82,0.1)', color: 'var(--red)' }}>
          {error}
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-hidden">
        {step === 'pick' ? (
          <div className="grid grid-cols-1 lg:grid-cols-[252px_1fr] h-full overflow-hidden">
            {/* Bench (left) */}
            <div className="flex flex-col overflow-hidden" style={{ borderRight: '1px solid var(--b1)', background: 'var(--bg2)' }}>
              <div className="px-4 pt-3 pb-2 shrink-0" style={{ borderBottom: '1px solid var(--b1)' }}>
                <div className="font-cabinet text-[13px] font-extrabold mb-0.5">Player bench</div>
                <div className="text-[10px]" style={{ color: 'var(--mu)' }}>Tap to select · {count}/11 picked</div>
              </div>
              {/* Search */}
              <div className="px-4 py-2 shrink-0">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search player..."
                  className="w-full rounded-[8px] px-3 py-2 text-[12px] outline-none"
                  style={{ background: 'var(--surface)', border: '1px solid var(--b1)', color: 'var(--tx)' }}
                />
              </div>
              {/* Role tabs */}
              <div className="flex gap-1 px-4 pb-2 shrink-0 flex-wrap">
                {[
                  { key: 'all', label: 'All' },
                  { key: 'batsman', label: 'Bat' },
                  { key: 'bowler', label: 'Bowl' },
                  { key: 'all-rounder', label: 'AR' },
                  { key: 'wicket-keeper', label: 'WK' },
                ].map((r) => (
                  <button
                    key={r.key}
                    onClick={() => setRoleFilter(r.key)}
                    className="font-cabinet text-[10px] font-bold px-2.5 py-1 rounded-full border-none transition-all"
                    style={{
                      background: roleFilter === r.key ? 'rgba(45,214,122,0.08)' : 'transparent',
                      border: `1px solid ${roleFilter === r.key ? 'rgba(45,214,122,0.25)' : 'var(--b1)'}`,
                      color: roleFilter === r.key ? 'var(--green)' : 'var(--mu)',
                    }}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              {/* Player list */}
              <div className="flex-1 overflow-y-auto px-4 pb-4">
                {filteredPlayers.map((p) => {
                  const isSelected = selectedPlayerIds.includes(p.player_id);
                  const canAdd = count < 11;
                  const role = ROLE_TAGS[(p.player_role || '').toLowerCase()] || { label: '?', color: 'var(--mu)', bg: 'var(--faint)' };

                  return (
                    <button
                      key={p.player_id}
                      onClick={() => togglePlayer(p.player_id)}
                      disabled={!isSelected && !canAdd}
                      className="w-full flex items-center gap-2 rounded-btn mb-1.5 text-left border-none transition-all disabled:opacity-25"
                      style={{
                        background: isSelected ? 'rgba(45,214,122,0.05)' : 'var(--surface)',
                        border: isSelected ? '1px solid var(--green)' : '1px solid var(--b1)',
                        padding: '8px 10px',
                      }}
                    >
                      <PlayerAvatar
                        name={p.player_name}
                        imageUrl={p.image_url}
                        size={30}
                        radius={7}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-medium truncate" style={{ color: isSelected ? 'var(--tx)' : 'var(--tx2)' }}>
                          {p.player_name}
                        </div>
                        <div className="text-[10px]" style={{ color: 'var(--mu)' }}>{p.team}</div>
                      </div>
                      <span
                        className="font-cabinet text-[9px] font-bold rounded px-1.5 py-0.5 shrink-0"
                        style={{ color: role.color, background: role.bg }}
                      >
                        {role.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected preview (right / mobile: below) */}
            <div className="flex flex-col overflow-y-auto p-6" style={{ background: 'var(--bg)' }}>
              <div className="font-cabinet text-[13px] font-extrabold mb-3">
                Your XI <span style={{ color: 'var(--green)' }}>({count}/11)</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {selectedPlayerIds.map((id, i) => {
                  const p = allPlayers.find((x) => x.player_id === id);
                  if (!p) return null;
                  return (
                    <div
                      key={id}
                      className="flex items-center gap-2 rounded-btn px-3 py-2"
                      style={{ background: 'var(--surface)', border: '1px solid var(--b1)' }}
                    >
                      <PlayerAvatar
                        name={p.player_name}
                        imageUrl={p.image_url}
                        seed={String.fromCharCode(65 + (i % 5))}
                        size={28}
                        radius={6}
                      />
                      <span className="text-[11px] font-medium truncate">{p.player_name.split(' ').pop()}</span>
                    </div>
                  );
                })}
              </div>
              {count < 11 && (
                <div className="mt-4 text-[12px] text-center" style={{ color: 'var(--mu)' }}>
                  Select {11 - count} more player{11 - count !== 1 ? 's' : ''} from the bench
                </div>
              )}
            </div>
          </div>
        ) : (
          /* POWER ASSIGNMENT STEP */
          <div className="flex flex-col h-full overflow-hidden">
            {/* Budget bar */}
            <div className="px-6 py-3 shrink-0" style={{ borderBottom: '1px solid var(--b1)' }}>
              <div className="h-[5px] rounded overflow-hidden mb-1.5" style={{ background: 'var(--faint)' }}>
                <div
                  className="h-full rounded transition-all duration-300"
                  style={{
                    width: `${Math.round((totalUsed / TOTAL_POWER) * 100)}%`,
                    background: isBalanced ? 'var(--green)' : 'var(--amber)',
                  }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-cabinet font-semibold" style={{ color: 'var(--mu)' }}>
                <span>1x min · 6x max per player</span>
                <span>
                  <span style={{ color: isBalanced ? 'var(--green)' : 'var(--amber)' }}>{totalUsed}</span> / {TOTAL_POWER}
                  {isBalanced ? ' · Balanced ✓' : ''}
                </span>
              </div>
            </div>

            {/* Presets */}
            <div className="flex gap-1.5 px-6 py-2 shrink-0 flex-wrap" style={{ borderBottom: '1px solid var(--b1)' }}>
              {[
                { key: 'reset', label: '⚖️ Reset', action: () => { const u: Record<string, number> = {}; selectedPlayers.forEach((p) => { u[p.player_id] = DEFAULT_POWER; }); setPowers(u); } },
                { key: 'bat', label: '🏏 Batters', action: () => applyPreset('batsman') },
                { key: 'bowl', label: '🎯 Bowlers', action: () => applyPreset('bowler') },
                { key: 'ar', label: '⚡ All-rounders', action: () => applyPreset('all-rounder') },
              ].map((p) => (
                <button
                  key={p.key}
                  onClick={p.action}
                  className="font-cabinet text-[11px] font-semibold px-3 py-1.5 rounded-full border-none transition-all"
                  style={{ border: '1px solid var(--b1)', color: 'var(--mu)', background: 'transparent' }}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Player power rows */}
            <div className="flex-1 overflow-y-auto px-4 md:px-6 py-3">
              {selectedPlayers.map((player, i) => {
                const pw = powers[player.player_id] || DEFAULT_POWER;
                const pct = ((pw - MIN_POWER) / (MAX_POWER - MIN_POWER) * 100).toFixed(1);
                const isMax = pw >= MAX_POWER;
                const isMin = pw <= MIN_POWER;
                const fillColor = isMax ? 'var(--red)' : isMin ? 'var(--blue)' : 'var(--amber)';
                const valColor = isMax ? 'var(--red)' : isMin ? 'var(--blue)' : 'var(--amber)';

                return (
                  <div
                    key={player.player_id}
                    className="rounded-[11px] px-3.5 py-3 mb-2"
                    style={{
                      background: 'var(--surface)',
                      border: isMax ? '1px solid rgba(240,82,82,0.25)' : '1px solid var(--b1)',
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <PlayerAvatar
                        name={player.player_name}
                        imageUrl={player.image_url}
                        seed={String.fromCharCode(65 + (i % 5))}
                        size={36}
                        radius={9}
                        fontSize={11}
                      />

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold truncate">{player.player_name}</div>
                        <div className="text-[10px]" style={{ color: 'var(--mu)' }}>
                          {player.team} · {player.points_earned > 0 ? `${player.points_earned}pts` : player.player_role || ''}
                        </div>
                      </div>

                      {/* Points if earned */}
                      {player.points_earned > 0 && (
                        <div className="font-cabinet text-[14px] font-extrabold shrink-0" style={{ color: 'var(--green)' }}>
                          {player.points_earned}
                        </div>
                      )}

                      {/* Slider + buttons */}
                      <div className="flex items-center gap-2 shrink-0" style={{ width: 200 }}>
                        <button
                          onClick={() => setPower(player.player_id, pw - 1)}
                          disabled={isMin}
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[14px] font-bold border-none transition-all disabled:opacity-20"
                          style={{ background: 'var(--surface2)', color: 'var(--tx)' }}
                        >
                          −
                        </button>
                        <div className="flex-1 relative h-8 flex items-center">
                          <div className="absolute left-0 right-0 h-[5px] rounded" style={{ background: 'var(--faint)' }} />
                          <div
                            className="absolute left-0 h-[5px] rounded transition-all"
                            style={{ width: `${pct}%`, background: fillColor }}
                          />
                          <div
                            className="absolute w-[22px] h-[22px] rounded-full transition-all"
                            style={{
                              left: `${pct}%`,
                              transform: 'translateX(-50%)',
                              background: fillColor,
                              border: '2.5px solid rgba(0,0,0,0.35)',
                            }}
                          />
                        </div>
                        <button
                          onClick={() => setPower(player.player_id, pw + 1)}
                          disabled={isMax}
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[14px] font-bold border-none transition-all disabled:opacity-20"
                          style={{ background: 'var(--surface2)', color: 'var(--tx)' }}
                        >
                          +
                        </button>
                      </div>

                      {/* Power value */}
                      <div className="font-cabinet text-[18px] font-black min-w-[32px] text-center" style={{ color: valColor }}>
                        {pw}<small className="text-[10px] font-semibold" style={{ color: 'var(--mu)' }}>x</small>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  function applyPreset(targetRole: string) {
    const updated: Record<string, number> = {};
    const players = selectedPlayers;
    const targets = players.filter((p) => (p.player_role || '').toLowerCase() === targetRole);
    const others = players.filter((p) => (p.player_role || '').toLowerCase() !== targetRole);

    // Set everyone to min
    players.forEach((p) => { updated[p.player_id] = MIN_POWER; });

    // Boost targets
    let budget = TOTAL_POWER - players.length * MIN_POWER;
    for (const t of targets) {
      const add = Math.min(MAX_POWER - MIN_POWER, budget);
      updated[t.player_id] += add;
      budget -= add;
    }

    // Distribute remaining to others
    for (const o of others) {
      if (budget <= 0) break;
      const add = Math.min(MAX_POWER - updated[o.player_id], budget);
      updated[o.player_id] += add;
      budget -= add;
    }

    setPowers(updated);
  }
}
