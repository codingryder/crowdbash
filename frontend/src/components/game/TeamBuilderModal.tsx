import { useEffect, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { usePlayingXi } from '../../hooks/usePlayingXi';
import { XiStatusBadge } from './XiStatusBadge';
import type { Sport, SquadPlayer } from '../../types';
import { PlayerAvatar } from '../ui/PlayerAvatar';

const TOTAL_POWER = 33;
const MAX_POWER = 6;
const MIN_POWER = 1;
const DEFAULT_POWER = 3;

type Step = 'pick' | 'power' | 'locked';

// Cricket role display tags. Football has its own map below.
const CRICKET_ROLE_TAGS: Record<string, { label: string; color: string; bg: string }> = {
  batsman: { label: 'BAT', color: 'var(--green)', bg: 'rgba(45,214,122,0.1)' },
  bowler: { label: 'BOWL', color: 'var(--purple)', bg: 'rgba(139,92,246,0.1)' },
  'all-rounder': { label: 'AR', color: 'var(--amber)', bg: 'rgba(245,158,11,0.1)' },
  'wicket-keeper': { label: 'WK', color: 'var(--mu)', bg: 'rgba(192,194,200,0.08)' },
};

const FOOTBALL_ROLE_TAGS: Record<string, { label: string; color: string; bg: string }> = {
  GK: { label: 'GK', color: 'var(--red)', bg: 'rgba(240,82,82,0.1)' },
  DEF: { label: 'DEF', color: 'var(--blue)', bg: 'rgba(59,130,246,0.1)' },
  MID: { label: 'MID', color: 'var(--amber)', bg: 'rgba(245,158,11,0.1)' },
  FW: { label: 'FW', color: 'var(--green)', bg: 'rgba(45,214,122,0.1)' },
};

interface Props {
  roomName: string;
  sport: Sport;
  onSelectSquad: (ids: string[]) => Promise<void>;
  onSaveWeightages: (w: Array<{ player_id: string; weightage: number }>) => Promise<void>;
  onLockSquad: () => Promise<void>;
  onClose: () => void;
}

export function TeamBuilderModal({ roomName: _roomName, sport, onSelectSquad, onSaveWeightages, onLockSquad, onClose }: Props) {
  const isFootball = sport === 'football';
  const availableSquads = useGameStore((s) => s.availableSquads);
  const selectedPlayerIds = useGameStore((s) => s.selectedPlayerIds);
  const game = useGameStore((s) => s.game);
  const togglePlayer = useGameStore((s) => s.togglePlayer);
  const setSelectedPlayerIds = useGameStore((s) => s.setSelectedPlayerIds);
  const teamBuilderMode = useGameStore((s) => s.teamBuilderMode);
  const { announced: xiAnnounced, isInXi } = usePlayingXi();

  // Reshuffle (power-only) opens the modal at the power step and locks the
  // user out of the player-pick step entirely — they can only redistribute
  // power across their existing XI, not swap players.
  // xiOnly mode opens straight on the picker with the bench narrowed to
  // only the announced playing squad — for cricket that's xi_a + xi_b,
  // for football match_squads is already matchday (lineup + named subs)
  // post team-sheet drop.
  const isPowerOnly = teamBuilderMode === 'powerOnly';
  const isXiOnly = teamBuilderMode === 'xiOnly';
  const hasSelected = game && game.player_weightages.filter((pw) => pw.selected).length === 11;
  const [step, setStep] = useState<Step>(
    isPowerOnly ? 'power'
      : isXiOnly ? 'pick'
      : (hasSelected ? 'power' : 'pick'),
  );
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
  // ID of the picked player armed for replacement. Tap a card on the right
  // to arm; the next bench tap swaps that player out for whoever was tapped,
  // preserving slot order. Tap the armed card again (or Cancel) to disarm.
  const [swapTargetId, setSwapTargetId] = useState<string | null>(null);

  const teams = Object.entries(availableSquads);
  const count = selectedPlayerIds.length;

  // All players flat
  const allPlayers: SquadPlayer[] = [];
  for (const [, players] of teams) {
    for (const p of players as SquadPlayer[]) allPlayers.push(p);
  }

  // ── Composition validation (mirrors backend role caps) ─────────────────
  // Backend rejects squads that violate caps with a clear error, but until
  // now the client showed nothing until the user hit "Assign Power →" and
  // got back an after-the-fact toast. Compute the same checks here so the
  // user sees the constraints live.
  // Cricket caps mirror backend ROLE_CAPS: max-6 BAT / max-3 AR / max-5 BOWL,
  // min-1 WK. Football caps mirror FOOTBALL_ROLE_CAPS: 1 GK, 3-5 DEF/MID, 1-3 FW.
  const CRICKET_CAP_VALUES = { batsman: 6, 'all-rounder': 3, bowler: 5 } as const;
  const MIN_WK = 1;
  const FOOTBALL_CAP_RANGES = {
    GK: [1, 1],
    DEF: [3, 5],
    MID: [3, 5],
    FW: [1, 3],
  } as const;

  function _cricketRoleKey(role: string): 'batsman' | 'all-rounder' | 'bowler' | 'wicket-keeper' | 'unknown' {
    const r = (role || '').toLowerCase();
    if (r.includes('keep') || r === 'wk') return 'wicket-keeper';
    if (r.includes('all')) return 'all-rounder';
    if (r.includes('bowl')) return 'bowler';
    if (r.includes('bat')) return 'batsman';
    return 'unknown';
  }

  function _footballRoleKey(role: string): 'GK' | 'DEF' | 'MID' | 'FW' | 'unknown' {
    const r = (role || '').toUpperCase().trim();
    if (!r) return 'unknown';
    if (r === 'GK' || r === 'G' || r.includes('GOAL') || r.includes('KEEPER')) return 'GK';
    if (['DEF', 'D', 'DF', 'CB', 'LB', 'RB', 'LWB', 'RWB'].includes(r) || r.includes('DEFEN') || r.includes('BACK')) return 'DEF';
    if (['MID', 'M', 'MF', 'CM', 'CDM', 'CAM', 'LM', 'RM'].includes(r) || r.includes('MID')) return 'MID';
    if (['FW', 'F', 'FWD', 'ST', 'CF', 'LW', 'RW'].includes(r) || r.includes('FORW') || r.includes('ATTACK') || r.includes('STRIK') || r.includes('WING')) return 'FW';
    return 'unknown';
  }

  // Initialise an empty roleCounts object whose keys depend on the sport so
  // chip rendering and cap checks below can use the same indexer.
  const roleCounts: Record<string, number> = isFootball
    ? { GK: 0, DEF: 0, MID: 0, FW: 0, unknown: 0 }
    : { batsman: 0, 'all-rounder': 0, bowler: 0, 'wicket-keeper': 0, unknown: 0 };
  for (const pid of selectedPlayerIds) {
    const p = allPlayers.find(x => x.player_id === pid);
    const key = isFootball ? _footballRoleKey(p?.player_role || '') : _cricketRoleKey(p?.player_role || '');
    roleCounts[key]++;
  }

  // Build a single, actionable error message — first violation wins, same
  // ordering as the backend so the message matches what the API would say.
  let compositionError: string | null = null;
  if (count === 11) {
    if (isFootball) {
      const labels: Record<string, string> = { GK: 'goalkeeper', DEF: 'defender', MID: 'midfielder', FW: 'forward' };
      for (const role of ['GK', 'DEF', 'MID', 'FW'] as const) {
        const [lo, hi] = FOOTBALL_CAP_RANGES[role];
        const c = roleCounts[role] || 0;
        if (c < lo) { compositionError = `Pick at least ${lo} ${lo === 1 ? labels[role] : labels[role] + 's'}.`; break; }
        if (c > hi) { compositionError = `Too many ${labels[role]}s: max ${hi} allowed.`; break; }
      }
      if (!compositionError && roleCounts.unknown > 0) compositionError = `${roleCounts.unknown} player(s) have unrecognised positions.`;
    } else {
      if (roleCounts.batsman > CRICKET_CAP_VALUES.batsman) compositionError = `Too many batters: max ${CRICKET_CAP_VALUES.batsman} allowed.`;
      else if (roleCounts['all-rounder'] > CRICKET_CAP_VALUES['all-rounder']) compositionError = `Too many all-rounders: max ${CRICKET_CAP_VALUES['all-rounder']} allowed.`;
      else if (roleCounts.bowler > CRICKET_CAP_VALUES.bowler) compositionError = `Too many bowlers: max ${CRICKET_CAP_VALUES.bowler} allowed.`;
      else if (roleCounts['wicket-keeper'] < MIN_WK) compositionError = `Pick at least ${MIN_WK} wicket-keeper.`;
    }
  }
  const compositionValid = compositionError === null;

  // xiOnly mode: narrow the bench to the announced playing squad. For
  // cricket that's strictly the 22 starters in xi_a ∪ xi_b. For football
  // we already get matchday squad (lineup + named subs) in match_squads
  // post team-sheet drop, so trust the existing pool.
  const xiOnlyMatch = (p: SquadPlayer): boolean => {
    if (!isXiOnly) return true;
    if (isFootball) return true;
    return isInXi(p.player_name);
  };

  // Filter for bench — sport-aware so the role filter pills match whatever
  // sport this room is, and the comparison goes through the canonical key
  // function (so e.g. ESPN-tagged "FWD" still matches the "FW" filter).
  const filteredPlayers = allPlayers.filter((p) => {
    if (!xiOnlyMatch(p)) return false;
    if (roleFilter !== 'all') {
      const k = isFootball ? _footballRoleKey(p.player_role || '') : _cricketRoleKey(p.player_role || '');
      if (k !== roleFilter) return false;
    }
    if (search && !p.player_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // When entering xiOnly mode, deselect any pre-picked players who are no
  // longer eligible (cricket: not in xi_a/xi_b; football: not in
  // match_squads). Without this, the picker count would still claim 11
  // selected even though those players are hidden from the bench.
  useEffect(() => {
    if (!isXiOnly || allPlayers.length === 0) return;
    const eligible = new Set(allPlayers.filter(xiOnlyMatch).map(p => p.player_id));
    const filtered = selectedPlayerIds.filter(id => eligible.has(id));
    if (filtered.length !== selectedPlayerIds.length) {
      setSelectedPlayerIds(filtered);
    }
    // Run only on mode change / availability change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isXiOnly, allPlayers.length, xiAnnounced]);

  // Power calculations
  const selectedPlayers = game?.player_weightages.filter((pw) => pw.selected) || [];
  const totalUsed = Object.values(powers).reduce((s, v) => s + v, 0);
  const isBalanced = totalUsed === TOTAL_POWER;

  function setPower(playerId: string, newVal: number) {
    newVal = Math.max(MIN_POWER, Math.min(MAX_POWER, newVal));
    // Manual budgeting in both reshuffle (powerOnly) and full mode — nudging
    // a single slider never auto-redistributes power across the rest of the
    // XI. The budget bar and Lock button keep the over/under-33 constraint
    // visible; presets (Reset / role boosts) are the bulk redistribution
    // path when the user wants a one-tap layout.
    setPowers({ ...powers, [playerId]: newVal });
  }

  // Bench tap behaviour depends on swap-arm state. When a picked player is
  // armed, the next bench tap replaces them in-place (preserving slot order).
  // Tapping the armed player itself (or another already-picked player) just
  // re-arms / disarms — it never deselects under your finger by accident.
  function handleBenchClick(playerId: string) {
    if (swapTargetId) {
      if (playerId === swapTargetId) {
        setSwapTargetId(null);
        return;
      }
      if (selectedPlayerIds.includes(playerId)) {
        setSwapTargetId(playerId);
        return;
      }
      setSelectedPlayerIds(selectedPlayerIds.map((id) => (id === swapTargetId ? playerId : id)));
      setSwapTargetId(null);
      return;
    }
    togglePlayer(playerId);
  }

  function handleRemovePicked(playerId: string) {
    setSelectedPlayerIds(selectedPlayerIds.filter((id) => id !== playerId));
    if (swapTargetId === playerId) setSwapTargetId(null);
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
      // Defensive: if the user changed the XI on step 1 but the swap isn't
      // reflected in the game's saved player_weightages yet (e.g. they
      // closed step 1 without going through "Assign Power →"), persist the
      // current selection before weightages so the squad swap doesn't get
      // silently dropped. We only call select-squad when there's an actual
      // diff to avoid an extra round-trip on the common no-swap path.
      // Skipped entirely in powerOnly (reshuffle) mode — users can't have
      // changed the XI from this surface, and the backend would reject
      // any swap during reshuffle anyway.
      if (!isPowerOnly) {
        const savedIds = (game?.player_weightages || []).filter(pw => pw.selected).map(pw => pw.player_id).sort();
        const currentIds = [...selectedPlayerIds].sort();
        const squadDiffers = savedIds.length !== currentIds.length || savedIds.some((id, i) => id !== currentIds[i]);
        if (squadDiffers && currentIds.length === 11) {
          await onSelectSquad(selectedPlayerIds);
        }
      }

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
          {['Pick your 11', 'Assign power', 'Lock in'].map((label, i) => {
            const stepKey = ['pick', 'power', 'locked'][i];
            const isActive = step === stepKey;
            // Allow clicking back from "Assign power" → "Pick your 11" so the
            // user can swap a player who's no longer in the announced XI
            // (e.g. Vitinha / Davies tagged NOT IN XI) without closing the
            // modal. Forward jumps stay disabled — those go through their
            // normal Confirm/Lock buttons.
            // Player-edit (full mode) lets users hop back to step 1 to swap
            // players. Reshuffle (powerOnly) locks them on the power step.
            const canClick = !isPowerOnly && step === 'power' && stepKey === 'pick';
            return (
              <div key={label} className="flex items-center">
                {i > 0 && <span className="text-[13px] mx-1" style={{ color: 'var(--faint)' }}>›</span>}
                <button
                  type="button"
                  onClick={canClick ? () => setStep('pick') : undefined}
                  disabled={!canClick && !isActive}
                  className="flex items-center gap-1.5 px-3 text-[12px] font-semibold border-none bg-transparent"
                  style={{
                    color: isActive ? 'var(--green)' : 'var(--mu)',
                    cursor: canClick ? 'pointer' : 'default',
                    textDecoration: canClick ? 'underline dotted' : 'none',
                    textUnderlineOffset: 4,
                  }}
                >
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center font-cabinet text-[9px] font-extrabold shrink-0"
                    style={{
                      border: isActive ? 'none' : '1.5px solid currentColor',
                      background: isActive ? 'var(--green)' : 'transparent',
                      color: isActive ? '#071a0e' : 'inherit',
                    }}
                  >
                    {i + 1}
                  </div>
                  <span className="hidden md:inline">{label}</span>
                </button>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-3">
          <div className="text-[12px]" style={{ color: 'var(--mu)' }}>
            {step === 'pick' && <><span className="font-cabinet font-bold" style={{ color: 'var(--green)' }}>{count}</span>/11 picked</>}
            {step === 'power' && <><span className="font-cabinet font-bold" style={{ color: isBalanced ? 'var(--green)' : 'var(--amber)' }}>{totalUsed}</span>/33 power</>}
          </div>
          {step === 'pick' && (
            <button
              onClick={handleConfirmSquad}
              disabled={count !== 11 || !compositionValid || loading}
              title={count !== 11 ? `Pick ${11 - count} more player${11 - count !== 1 ? 's' : ''}` : compositionError || ''}
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
              className="font-cabinet text-[12px] md:text-[13px] font-extrabold border-none rounded-[8px] px-3 md:px-5 py-1.5 md:py-2 transition-all disabled:opacity-30 whitespace-nowrap"
              style={{ background: 'var(--green)', color: '#071a0e' }}
            >
              {loading ? 'Locking...' : game?.squad_locked ? 'Save →' : 'Lock in →'}
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

      {/* Live composition strip (pick step only) — gives users immediate
          feedback on role caps so they know WHY the Assign Power button is
          gated, instead of clicking and getting an after-the-fact error. */}
      {step === 'pick' && (
        <div className="flex items-center gap-2 flex-wrap px-4 md:px-6 py-2 shrink-0" style={{ borderBottom: '1px solid var(--b1)', background: 'var(--bg2)' }}>
          <span className="text-[10px] uppercase tracking-[1px]" style={{ color: 'var(--mu)' }}>Squad mix:</span>
          {(isFootball
            ? (['GK', 'DEF', 'MID', 'FW'] as const).map(role => {
                const [lo, hi] = FOOTBALL_CAP_RANGES[role];
                const current = roleCounts[role] || 0;
                const rule = lo === hi ? `${lo}` : `${lo}-${hi}`;
                const ok = current >= lo && current <= hi;
                return { role, label: role, current, rule, ok };
              })
            : [
                { role: 'wicket-keeper', label: 'WK', current: roleCounts['wicket-keeper'], rule: `min ${MIN_WK}`, ok: roleCounts['wicket-keeper'] >= MIN_WK },
                { role: 'batsman', label: 'BAT', current: roleCounts.batsman, rule: `max ${CRICKET_CAP_VALUES.batsman}`, ok: roleCounts.batsman <= CRICKET_CAP_VALUES.batsman },
                { role: 'all-rounder', label: 'AR', current: roleCounts['all-rounder'], rule: `max ${CRICKET_CAP_VALUES['all-rounder']}`, ok: roleCounts['all-rounder'] <= CRICKET_CAP_VALUES['all-rounder'] },
                { role: 'bowler', label: 'BOWL', current: roleCounts.bowler, rule: `max ${CRICKET_CAP_VALUES.bowler}`, ok: roleCounts.bowler <= CRICKET_CAP_VALUES.bowler },
              ]
          ).map(c => (
            <div
              key={c.role}
              className="flex items-center gap-1 rounded-[6px] px-2 py-1 text-[10px] font-bold"
              style={{
                background: c.ok ? 'rgba(45,214,122,0.08)' : 'rgba(240,82,82,0.12)',
                color: c.ok ? 'var(--green)' : 'var(--red)',
                border: `1px solid ${c.ok ? 'rgba(45,214,122,0.25)' : 'rgba(240,82,82,0.4)'}`,
                fontFamily: "'Cabinet Grotesk', sans-serif",
              }}
            >
              <span>{c.label}</span>
              <span style={{ fontWeight: 900 }}>{c.current}</span>
              <span style={{ opacity: 0.6 }}>· {c.rule}</span>
              <span>{c.ok ? '✓' : '✕'}</span>
            </div>
          ))}
          {compositionError && (
            <div className="text-[11px] ml-auto px-2.5 py-1 rounded-[6px]" style={{ background: 'rgba(240,82,82,0.12)', color: 'var(--red)', fontWeight: 600 }}>
              ⚠ {compositionError}
            </div>
          )}
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
                <div className="text-[10px]" style={{ color: swapTargetId ? 'var(--green)' : 'var(--mu)' }}>
                  {swapTargetId ? 'Tap a player to swap in' : `Tap to select · ${count}/11 picked`}
                </div>
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
              {/* Role tabs — sport-aware. */}
              <div className="flex gap-1 px-4 pb-2 shrink-0 flex-wrap">
                {(isFootball
                  ? [
                      { key: 'all', label: 'All' },
                      { key: 'GK', label: 'GK' },
                      { key: 'DEF', label: 'DEF' },
                      { key: 'MID', label: 'MID' },
                      { key: 'FW', label: 'FW' },
                    ]
                  : [
                      { key: 'all', label: 'All' },
                      { key: 'batsman', label: 'Bat' },
                      { key: 'bowler', label: 'Bowl' },
                      { key: 'all-rounder', label: 'AR' },
                      { key: 'wicket-keeper', label: 'WK' },
                    ]
                ).map((r) => (
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
                  const k = isFootball
                    ? _footballRoleKey(p.player_role || '')
                    : _cricketRoleKey(p.player_role || '');
                  const tagMap = isFootball ? FOOTBALL_ROLE_TAGS : CRICKET_ROLE_TAGS;
                  const role = tagMap[k] || { label: '?', color: 'var(--mu)', bg: 'var(--faint)' };
                  const isBenched = xiAnnounced && !isInXi(p.player_name);

                  const isArmedTarget = swapTargetId === p.player_id;
                  return (
                    <button
                      key={p.player_id}
                      onClick={() => handleBenchClick(p.player_id)}
                      disabled={swapTargetId ? false : !isSelected && !canAdd}
                      className="w-full flex items-center gap-2 rounded-btn mb-1.5 text-left border-none transition-all disabled:opacity-25"
                      style={{
                        background: isArmedTarget
                          ? 'rgba(45,214,122,0.12)'
                          : isSelected
                            ? 'rgba(45,214,122,0.05)'
                            : 'var(--surface)',
                        border: isArmedTarget
                          ? '1.5px solid var(--green)'
                          : isBenched
                            ? '1px solid rgba(240,82,82,0.55)'
                            : isSelected
                              ? '1px solid var(--green)'
                              : '1px solid var(--b1)',
                        borderLeftWidth: isBenched ? 3 : undefined,
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
                        <div className="text-[12px] font-medium truncate flex items-center gap-1.5" style={{ color: isSelected ? 'var(--tx)' : 'var(--tx2)' }}>
                          <span className="truncate">{p.player_name}</span>
                          {xiAnnounced && <XiStatusBadge inXi={isInXi(p.player_name)} />}
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
              {swapTargetId ? (
                <div
                  className="mb-3 px-3 py-2 rounded-btn flex items-center justify-between gap-2"
                  style={{ background: 'rgba(45,214,122,0.08)', border: '1px solid rgba(45,214,122,0.25)' }}
                >
                  <span className="text-[11px]" style={{ color: 'var(--green)' }}>
                    Tap a bench player to replace{' '}
                    <strong>{allPlayers.find((p) => p.player_id === swapTargetId)?.player_name}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => setSwapTargetId(null)}
                    className="text-[11px] bg-transparent border-none cursor-pointer shrink-0 underline"
                    style={{ color: 'var(--mu)' }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                count === 11 && (
                  <div className="mb-3 text-[11px]" style={{ color: 'var(--mu)' }}>
                    Tap a player to swap them out, or use ✕ to remove
                  </div>
                )
              )}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {selectedPlayerIds.map((id, i) => {
                  const p = allPlayers.find((x) => x.player_id === id);
                  if (!p) return null;
                  const isBenched = xiAnnounced && !isInXi(p.player_name);
                  const isArmed = swapTargetId === id;
                  return (
                    <div key={id} className="relative">
                      <button
                        type="button"
                        onClick={() => setSwapTargetId(isArmed ? null : id)}
                        className="w-full flex items-center gap-2 rounded-btn text-left border-none cursor-pointer transition-all"
                        style={{
                          padding: '8px 30px 8px 12px',
                          background: isArmed ? 'rgba(45,214,122,0.12)' : 'var(--surface)',
                          border: isArmed
                            ? '1.5px solid var(--green)'
                            : isBenched
                              ? '1px solid rgba(240,82,82,0.55)'
                              : '1px solid var(--b1)',
                          borderLeftWidth: isBenched ? 3 : undefined,
                        }}
                        title={
                          isArmed
                            ? 'Armed — tap a bench player to swap in'
                            : isBenched
                              ? 'Not in announced XI · tap to replace'
                              : 'Tap to replace'
                        }
                      >
                        <PlayerAvatar
                          name={p.player_name}
                          imageUrl={p.image_url}
                          seed={String.fromCharCode(65 + (i % 5))}
                          size={28}
                          radius={6}
                        />
                        {xiAnnounced && (
                          <span
                            title={isBenched ? 'Not in announced XI today' : 'In announced XI today'}
                            style={{
                              display: 'inline-block',
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: isBenched ? 'var(--red)' : 'var(--green)',
                              flexShrink: 0,
                            }}
                          />
                        )}
                        <span
                          className="text-[11px] font-medium truncate"
                          style={{ color: isBenched ? 'var(--red)' : undefined }}
                        >
                          {p.player_name.split(' ').pop()}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemovePicked(id);
                        }}
                        aria-label={`Remove ${p.player_name}`}
                        title="Remove from XI"
                        className="absolute rounded-full flex items-center justify-center border-none cursor-pointer"
                        style={{
                          top: '50%',
                          right: 6,
                          transform: 'translateY(-50%)',
                          width: 22,
                          height: 22,
                          background: 'var(--faint)',
                          color: 'var(--mu)',
                          fontSize: 13,
                          lineHeight: 1,
                          padding: 0,
                        }}
                      >
                        ×
                      </button>
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

            {/* Presets — sport-aware: cricket gets Batters/Bowlers/AR,
                football gets Defence/Midfield/Attack. */}
            <div className="flex gap-1.5 px-6 py-2 shrink-0 flex-wrap" style={{ borderBottom: '1px solid var(--b1)' }}>
              {(isFootball
                ? [
                    { key: 'reset', label: '⚖️ Reset', action: () => { const u: Record<string, number> = {}; selectedPlayers.forEach((p) => { u[p.player_id] = DEFAULT_POWER; }); setPowers(u); } },
                    { key: 'def', label: '🛡️ Defence', action: () => applyPreset('DEF') },
                    { key: 'mid', label: '🎯 Midfield', action: () => applyPreset('MID') },
                    { key: 'att', label: '⚡ Attack', action: () => applyPreset('FW') },
                  ]
                : [
                    { key: 'reset', label: '⚖️ Reset', action: () => { const u: Record<string, number> = {}; selectedPlayers.forEach((p) => { u[p.player_id] = DEFAULT_POWER; }); setPowers(u); } },
                    { key: 'bat', label: '🏏 Batters', action: () => applyPreset('batsman') },
                    { key: 'bowl', label: '🎯 Bowlers', action: () => applyPreset('bowler') },
                    { key: 'ar', label: '⚡ All-rounders', action: () => applyPreset('all-rounder') },
                  ]
              ).map((p) => (
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

                const isBenched = xiAnnounced && !isInXi(player.player_name);
                return (
                  <div
                    key={player.player_id}
                    className="rounded-[11px] px-3.5 py-3 mb-2"
                    style={{
                      background: 'var(--surface)',
                      border: isBenched
                        ? '1px solid rgba(240,82,82,0.55)'
                        : isMax
                          ? '1px solid rgba(240,82,82,0.25)'
                          : '1px solid var(--b1)',
                      borderLeftWidth: isBenched ? 3 : undefined,
                    }}
                  >
                    {(() => {
                      const sliderControls = (
                        <>
                          <button
                            onClick={() => setPower(player.player_id, pw - 1)}
                            disabled={isMin}
                            className="w-6 h-6 rounded-full flex items-center justify-center text-[14px] font-bold border-none transition-all disabled:opacity-20 shrink-0"
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
                            className="w-6 h-6 rounded-full flex items-center justify-center text-[14px] font-bold border-none transition-all disabled:opacity-20 shrink-0"
                            style={{ background: 'var(--surface2)', color: 'var(--tx)' }}
                          >
                            +
                          </button>
                        </>
                      );
                      const powerValue = (
                        <div className="font-cabinet text-[18px] font-black min-w-[32px] text-center" style={{ color: valColor }}>
                          {pw}<small className="text-[10px] font-semibold" style={{ color: 'var(--mu)' }}>x</small>
                        </div>
                      );
                      return (
                        <>
                          {/* Top row: avatar + name + (mobile) power value.
                              Desktop also keeps the slider inline here. */}
                          <div className="flex items-center gap-3">
                            <PlayerAvatar
                              name={player.player_name}
                              imageUrl={player.image_url}
                              seed={String.fromCharCode(65 + (i % 5))}
                              size={36}
                              radius={9}
                              fontSize={11}
                            />

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[13px] font-semibold truncate">{player.player_name}</span>
                                {xiAnnounced && <XiStatusBadge inXi={isInXi(player.player_name)} size="sm" />}
                              </div>
                              <div className="text-[10px]" style={{ color: 'var(--mu)' }}>
                                {player.team} · {player.points_earned > 0 ? `${player.points_earned}pts` : player.player_role || ''}
                              </div>
                            </div>

                            {player.points_earned > 0 && (
                              <div className="font-cabinet text-[14px] font-extrabold shrink-0" style={{ color: 'var(--green)' }}>
                                {player.points_earned}
                              </div>
                            )}

                            <div className="hidden md:flex items-center gap-2 shrink-0" style={{ width: 200 }}>
                              {sliderControls}
                            </div>

                            {powerValue}
                          </div>

                          {/* Mobile-only second row: full-width slider so the
                              player name above gets the room it needs. */}
                          <div className="md:hidden flex items-center gap-2 mt-3">
                            {sliderControls}
                          </div>
                        </>
                      );
                    })()}
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
    // Match against the canonical key so football's "FW" preset catches
    // ESPN-tagged "FWD" / "ST" / "LW" players, and cricket's "batsman" preset
    // catches "BAT" / "Batter" variants the source data might emit.
    const matches = (p: { player_role?: string }) =>
      isFootball
        ? _footballRoleKey(p.player_role || '') === targetRole
        : _cricketRoleKey(p.player_role || '') === targetRole;
    const targets = players.filter(matches);
    const others = players.filter((p) => !matches(p));

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
