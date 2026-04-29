import { useState, useEffect, useRef } from 'react';
import { CricketPitch } from './CricketPitch';
import { FootballPitch } from './FootballPitch';
import { PlayerAvatar } from '../ui/PlayerAvatar';
import { useGameStore } from '../../store/gameStore';
import { useGame } from '../../hooks/useGame';
import { useIsMobile } from '../../hooks/useIsMobile';
import type { Sport, SquadPlayer } from '../../types';
import { splitTeams } from '../../types';

const TOTAL_B = 33, MAX_B = 6, MIN_B = 1, DEF_B = 3;

type CricketRoleKey = 'BAT' | 'AR' | 'BOWL' | 'WK';
type FootballRoleKey = 'GK' | 'DEF' | 'MID' | 'FW';
type RoleKey = CricketRoleKey | FootballRoleKey;

// Per-team role caps as [min, max]. Mirrors backend ROLE_CAPS /
// FOOTBALL_ROLE_CAPS in app/api/routes/game.py — keep these in sync.
const CRICKET_CAPS: Record<CricketRoleKey, [number, number]> = {
  BAT: [0, 6], AR: [0, 3], BOWL: [0, 5], WK: [1, 11],
};
const FOOTBALL_CAPS: Record<FootballRoleKey, [number, number]> = {
  GK: [1, 1], DEF: [3, 5], MID: [3, 5], FW: [1, 3],
};

// Role-bucket order shown in the chip strip. Cricket renders WK separately
// (need-1 affordance), so the primary list omits it.
const CRICKET_PRIMARY: CricketRoleKey[] = ['BAT', 'AR', 'BOWL'];
const FOOTBALL_PRIMARY: FootballRoleKey[] = ['GK', 'DEF', 'MID', 'FW'];

function cricketRoleKey(role: string): CricketRoleKey | null {
  const r = (role || '').toLowerCase();
  if (r.includes('keep') || r === 'wk') return 'WK';
  if (r.includes('all')) return 'AR';
  if (r.includes('bowl')) return 'BOWL';
  if (r.includes('bat')) return 'BAT';
  return null;
}

function footballRoleKey(role: string): FootballRoleKey | null {
  const r = (role || '').toUpperCase().trim();
  if (!r) return null;
  if (r === 'GK' || r === 'G' || r.includes('GOAL') || r.includes('KEEPER')) return 'GK';
  if (['DEF', 'D', 'DF', 'CB', 'LB', 'RB', 'LWB', 'RWB'].includes(r) || r.includes('DEFEN') || r.includes('BACK')) return 'DEF';
  if (['MID', 'M', 'MF', 'CM', 'CDM', 'CAM', 'LM', 'RM'].includes(r) || r.includes('MID')) return 'MID';
  if (['FW', 'F', 'FWD', 'ST', 'CF', 'LW', 'RW'].includes(r) || r.includes('FORW') || r.includes('ATTACK') || r.includes('STRIK') || r.includes('WING')) return 'FW';
  return null;
}

function roleKeyOf(sport: Sport, role: string): RoleKey | null {
  return sport === 'football' ? footballRoleKey(role) : cricketRoleKey(role);
}

interface PitchWelcomeViewProps {
  roomId: string;
  roomName: string;
  sport: Sport;
  onComplete: () => void;
}

export function PitchWelcomeView({ roomId, roomName, sport, onComplete }: PitchWelcomeViewProps) {
  const isFootball = sport === 'football';
  const Pitch = isFootball ? FootballPitch : CricketPitch;
  // Typed as a partial map across all role keys so callers can index with the
  // wider RoleKey union without the keyof intersection collapsing to `never`.
  const ROLE_CAPS_PAIRS: Partial<Record<RoleKey, [number, number]>> = isFootball ? FOOTBALL_CAPS : CRICKET_CAPS;
  const PRIMARY_ROLES: RoleKey[] = isFootball ? FOOTBALL_PRIMARY : CRICKET_PRIMARY;
  const ROLE_LABELS_LONG: Record<RoleKey, string> = {
    BAT: 'batsman', AR: 'all-rounder', BOWL: 'bowler', WK: 'wicket-keeper',
    GK: 'goalkeeper', DEF: 'defender', MID: 'midfielder', FW: 'forward',
  };
  // Cricket validates "min 1 wicket-keeper" separately; football validates
  // every role's min via PRIMARY_ROLES + ROLE_CAPS_PAIRS.
  const wkRequired = !isFootball;
  const MIN_WK = 1;
  const { selectSquad, saveWeightages, lockSquad, fetchSquads, fetchGameState } = useGame(roomId);
  const availableSquads = useGameStore(s => s.availableSquads);
  const squadsLoading = useGameStore(s => s.squadsLoading);
  const game = useGameStore(s => s.game);

  const [slots, setSlots] = useState<(SquadPlayer | null)[]>(new Array(11).fill(null));
  const [powers, setPowers] = useState<number[]>(new Array(11).fill(DEF_B));
  const [selectedPlayer, setSelectedPlayer] = useState<SquadPlayer | null>(null);
  const [activeSlot, setActiveSlot] = useState<number | null>(null); // slot being power-adjusted
  const [roleFilter, setRoleFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [locking, setLocking] = useState(false);
  const [error, setError] = useState('');
  const [initialized, setInitialized] = useState(false);
  const [mobileStep, setMobileStep] = useState<'pick' | 'power'>('pick');
  const [mobileSelected, setMobileSelected] = useState<Set<string>>(new Set());
  const isMobile = useIsMobile();

  const [t1, t2] = splitTeams(roomName);

  useEffect(() => { fetchSquads(); }, []);

  // Pre-populate from existing game state
  useEffect(() => {
    if (initialized || !game || !availableSquads) return;
    const allP: SquadPlayer[] = Object.values(availableSquads).flat();
    if (!allP.length) return;
    const selected = game.player_weightages.filter(pw => pw.selected);
    if (selected.length > 0) {
      const newSlots: (SquadPlayer | null)[] = new Array(11).fill(null);
      const newPowers: number[] = new Array(11).fill(DEF_B);
      const newMobileSelected = new Set<string>();
      selected.forEach((pw, i) => {
        if (i >= 11) return;
        const player = allP.find(p => p.player_id === pw.player_id);
        if (player) {
          newSlots[i] = player;
          newPowers[i] = pw.weightage || DEF_B;
          newMobileSelected.add(player.player_id);
        }
      });
      setSlots(newSlots);
      setPowers(newPowers);
      setMobileSelected(newMobileSelected);
      // If already has 11 players, go straight to power step on mobile
      if (isMobile && newMobileSelected.size === 11) {
        setMobileStep('power');
      }
      setInitialized(true);
    }
  }, [game, availableSquads, initialized, isMobile]);

  const allPlayers: SquadPlayer[] = Object.values(availableSquads || {}).flat();
  const placedIds = new Set(slots.filter(Boolean).map(p => p!.player_id));
  const pickCount = slots.filter(Boolean).length;
  const totalUsed = powers.reduce((s, v, i) => slots[i] ? s + v : s, 0);
  const isBalanced = totalUsed === TOTAL_B;

  // ── Reshuffle auto-save ────────────────────────────────────────────────
  // The banner promises "auto-locks when time is up", and users' power
  // edits live entirely in local React state — so when the window expires
  // and PitchWelcomeView unmounts (because canEditTeam flips false), we
  // need to persist their current valid weightages on the way out.
  //
  // Refs hold the latest powers/slots so the unmount cleanup reads them at
  // unmount time rather than the values captured when the effect ran. We
  // distinguish window-expiry unmounts (editWindowOpen === false, save) from
  // user-initiated exits like "Back to room" (editWindowOpen still true,
  // skip — they didn't lock, presumed intentional discard).
  const powersRef = useRef(powers);
  const slotsRef = useRef(slots);
  const saveWeightagesRef = useRef(saveWeightages);
  useEffect(() => { powersRef.current = powers; }, [powers]);
  useEffect(() => { slotsRef.current = slots; }, [slots]);
  useEffect(() => { saveWeightagesRef.current = saveWeightages; }, [saveWeightages]);

  useEffect(() => {
    return () => {
      const state = useGameStore.getState();
      if (state.editWindowOpen) return; // user-initiated exit while window still open
      if (!state.game?.squad_locked) return; // not a reshuffle session
      const currentSlots = slotsRef.current;
      const currentPowers = powersRef.current;
      const filled = currentSlots.filter(Boolean).length;
      const total = currentSlots.reduce((acc, slot, i) => slot ? acc + currentPowers[i] : acc, 0);
      if (filled !== 11 || total !== TOTAL_B) return;
      const weightages = currentSlots
        .map((p, i) => p ? { player_id: p.player_id, weightage: currentPowers[i] } : null)
        .filter(Boolean) as Array<{ player_id: string; weightage: number }>;
      // Don't pass skipRefetch — let it refetch into the gameStore so the
      // room view that takes over from PitchWelcomeView shows the new
      // weightages immediately. fetchGameState only writes to Zustand,
      // safe to fire after this component unmounts.
      saveWeightagesRef.current(weightages)
        .catch((e: unknown) => console.error('Reshuffle auto-save failed', e));
    };
  }, []);

  // Role composition counts — desktop uses slots, mobile step 1 uses
  // mobileSelected. Initialised with every key the active sport cares about
  // so chip rendering can index the same Record without optional chaining.
  const emptyCounts = (): Record<RoleKey, number> => {
    const init: Partial<Record<RoleKey, number>> = {};
    Object.keys(ROLE_CAPS_PAIRS).forEach(k => { init[k as RoleKey] = 0; });
    return init as Record<RoleKey, number>;
  };
  const roleCounts: Record<RoleKey, number> = emptyCounts();
  slots.forEach(p => { if (p) { const k = roleKeyOf(sport, p.player_role); if (k) roleCounts[k] = (roleCounts[k] || 0) + 1; } });
  const mobileRoleCounts: Record<RoleKey, number> = emptyCounts();
  mobileSelected.forEach(pid => {
    const pl = allPlayers.find(p => p.player_id === pid);
    if (pl) { const k = roleKeyOf(sport, pl.player_role); if (k) mobileRoleCounts[k] = (mobileRoleCounts[k] || 0) + 1; }
  });
  const activeRoleCounts = isMobile && mobileStep === 'pick' ? mobileRoleCounts : roleCounts;
  const wkValid = !wkRequired || (activeRoleCounts['WK' as RoleKey] || 0) >= MIN_WK;
  // Football: composition is valid only when every primary role hits its
  // min and stays under its max. Cricket: WK min + per-role max.
  const compositionValid = isFootball
    ? PRIMARY_ROLES.every(k => {
        const pair = ROLE_CAPS_PAIRS[k];
        if (!pair) return true;
        const [lo, hi] = pair;
        const c = roleCounts[k] || 0;
        return c >= lo && c <= hi;
      })
    : (roleCounts['WK' as RoleKey] || 0) >= MIN_WK;
  const canLock = pickCount === 11 && isBalanced && compositionValid;

  const filterMatchesRole = (p: SquadPlayer): boolean => {
    if (roleFilter === 'all') return true;
    const k = roleKeyOf(sport, p.player_role);
    return !!k && k.toLowerCase() === roleFilter.toLowerCase();
  };
  const benchPlayers = allPlayers.filter(p => {
    if (!filterMatchesRole(p)) return false;
    if (search && !p.player_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  const teams = [...new Set(benchPlayers.map(p => p.team))];

  function handleBenchClick(player: SquadPlayer) {
    if (placedIds.has(player.player_id)) return;
    setSelectedPlayer(selectedPlayer?.player_id === player.player_id ? null : player);
    setActiveSlot(null);
  }

  function handleSlotClick(index: number) {
    if (slots[index]) {
      if (activeSlot === index) {
        // Second click on same filled slot → remove player
        const updated = [...slots]; updated[index] = null; setSlots(updated);
        const pw = [...powers]; pw[index] = DEF_B; setPowers(pw);
        setActiveSlot(null);
      } else {
        // First click on filled slot → select for power adjustment
        setActiveSlot(index);
        setSelectedPlayer(null);
      }
    } else if (selectedPlayer) {
      const updated = [...slots]; updated[index] = selectedPlayer; setSlots(updated);
      setSelectedPlayer(null);
      setActiveSlot(null);
    }
  }

  const availablePower = TOTAL_B - totalUsed;

  function adjustPower(idx: number, delta: number) {
    const current = powers[idx];
    let newVal = current + delta;
    // Clamp to min/max
    newVal = Math.max(MIN_B, Math.min(MAX_B, newVal));
    if (newVal === current) return;
    // If increasing, check available budget
    if (delta > 0 && availablePower <= 0) return;
    if (delta > 0 && (newVal - current) > availablePower) {
      newVal = current + availablePower;
    }
    const pw = [...powers];
    pw[idx] = newVal;
    setPowers(pw);
  }

  function applyPreset(presetRoleKey: RoleKey | 'balanced') {
    const placed = slots.map((p, i) => ({ p, i })).filter(x => x.p);
    if (!placed.length) return;
    const pw = [...powers];
    placed.forEach(({ i }) => { pw[i] = MIN_B; });
    if (presetRoleKey === 'balanced') {
      placed.forEach(({ i }) => { pw[i] = DEF_B; });
    } else {
      // Boost players whose canonical role matches the preset (sport-aware).
      const targets = placed.filter(x => roleKeyOf(sport, x.p!.player_role) === presetRoleKey);
      let budget = TOTAL_B - (placed.length * MIN_B);
      targets.forEach(({ i }) => { const add = Math.min(MAX_B - MIN_B, budget); pw[i] += add; budget -= add; });
      let extra = TOTAL_B - pw.reduce((s, v, i) => slots[i] ? s + v : s, 0);
      placed.filter(x => roleKeyOf(sport, x.p!.player_role) !== presetRoleKey).forEach(({ i }) => {
        if (extra <= 0) return; const add = Math.min(MAX_B - pw[i], extra); pw[i] += add; extra -= add;
      });
    }
    setPowers(pw);
    setActiveSlot(null);
  }

  async function handleLockTeam() {
    if (pickCount !== 11 || !isBalanced) return;
    if (!compositionValid) {
      // Surface the first failing role so the user knows what to fix.
      const failing = PRIMARY_ROLES.find(k => {
        const pair = ROLE_CAPS_PAIRS[k];
        if (!pair) return false;
        return (roleCounts[k] || 0) < pair[0];
      });
      if (isFootball && failing) {
        const pair = ROLE_CAPS_PAIRS[failing];
        const lo = pair ? pair[0] : 1;
        const label = ROLE_LABELS_LONG[failing];
        setError(`Pick at least ${lo} ${lo === 1 ? label : label + 's'}.`);
      } else {
        setError(`Pick at least ${MIN_WK} ${ROLE_LABELS_LONG.WK}.`);
      }
      return;
    }
    setLocking(true); setError('');
    try {
      const playerIds = slots.filter(Boolean).map(p => p!.player_id);
      const weightages = slots.map((p, i) => p ? { player_id: p.player_id, weightage: powers[i] } : null).filter(Boolean) as Array<{ player_id: string; weightage: number }>;

      // Decide which sub-calls are needed based on (a) whether the squad is
      // already locked and (b) whether the user actually changed any players.
      // Three cases:
      //   - First-time pick (squad_locked=false): full flow — selectSquad,
      //     saveWeightages, lockSquad.
      //   - Football late-join window (squad_locked=true but the backend
      //     allows changes because room.late_join_open=true) and the user
      //     swapped a player: selectSquad to persist swap, saveWeightages,
      //     re-lock via lockSquad. The previous version skipped selectSquad
      //     here, which is why "save powers" silently dropped XI swaps for
      //     PSG vs Bayern.
      //   - Cricket reshuffle (squad_locked=true, no swap): saveWeightages
      //     only. selectSquad would 400 "Match has started" with no
      //     late_join window, so we don't even try.
      const savedIds = (game?.player_weightages || []).filter(pw => pw.selected).map(pw => pw.player_id).sort();
      const currentIds = [...playerIds].sort();
      const squadDiffers = savedIds.length !== currentIds.length || savedIds.some((id, i) => id !== currentIds[i]);
      const wasLocked = !!game?.squad_locked;

      if (!wasLocked || squadDiffers) {
        try {
          await selectSquad(playerIds, { skipRefetch: true });
        } catch (e) {
          // If the user didn't actually swap and the backend rejected the
          // call (e.g. cricket reshuffle without late_join), it's benign —
          // proceed to weightages so a power-only edit still saves.
          if (squadDiffers) throw e;
          console.warn('selectSquad rejected, continuing', e);
        }
      }
      await saveWeightages(weightages, { skipRefetch: true });
      // Re-lock when we either picked for the first time, or just re-selected
      // during a late-join swap (which the backend silently unlocked). Cricket
      // reshuffle (squad still locked, no swap) skips this — squad stays
      // locked already.
      if (!wasLocked || squadDiffers) {
        try {
          await lockSquad({ skipRefetch: true });
        } catch (e) {
          console.warn('lockSquad rejected (likely already locked), continuing', e);
        }
      }
      // Single refetch at the end so the room view sees updated weightages immediately.
      await fetchGameState();
      onComplete();
    } catch (e: unknown) {
      console.error('Failed to lock team', e);
      // Surface the backend's actual error so users (and we) can debug
      // role-cap / budget / squad-not-found cases instead of a generic message.
      const ax = e as { response?: { data?: { detail?: string } }; message?: string };
      const detail = ax?.response?.data?.detail || ax?.message || 'Please try again.';
      setError(`Failed to save team — ${detail}`);
    } finally { setLocking(false); }
  }

  // Mobile: toggle player selection (multi-select)
  function mobileTogglePlayer(playerId: string) {
    const newSet = new Set(mobileSelected);
    if (newSet.has(playerId)) {
      newSet.delete(playerId);
    } else if (newSet.size < 11) {
      newSet.add(playerId);
    }
    setMobileSelected(newSet);
  }

  // Mobile: place all selected players onto pitch slots
  function mobilePlaceAll() {
    const playerIds = Array.from(mobileSelected);
    const newSlots: (SquadPlayer | null)[] = new Array(11).fill(null);
    const newPowers: number[] = new Array(11).fill(DEF_B);
    playerIds.forEach((pid, i) => {
      if (i >= 11) return;
      const player = allPlayers.find(p => p.player_id === pid);
      if (player) {
        newSlots[i] = player;
        newPowers[i] = DEF_B;
      }
    });
    setSlots(newSlots);
    setPowers(newPowers);
    setMobileStep('power');
  }

  const getRoleBg = (role: string) => {
    const k = roleKeyOf(sport, role);
    // Cricket palette: green=BAT, purple=BOWL, amber=AR, neutral=WK
    // Football palette: red=GK, blue=DEF, amber=MID, green=FW
    if (isFootball) {
      if (k === 'GK') return { bg: 'rgba(240,82,82,0.1)', color: 'var(--red)' };
      if (k === 'DEF') return { bg: 'rgba(59,130,246,0.1)', color: 'var(--blue)' };
      if (k === 'MID') return { bg: 'rgba(245,158,11,0.1)', color: 'var(--amber)' };
      if (k === 'FW') return { bg: 'rgba(45,214,122,0.1)', color: 'var(--green)' };
      return { bg: 'rgba(192,194,200,0.08)', color: 'var(--muted)' };
    }
    if (k === 'BAT') return { bg: 'rgba(45,214,122,0.1)', color: 'var(--green)' };
    if (k === 'BOWL') return { bg: 'rgba(139,92,246,0.1)', color: 'var(--purple)' };
    if (k === 'AR') return { bg: 'rgba(245,158,11,0.1)', color: 'var(--amber)' };
    return { bg: 'rgba(192,194,200,0.08)', color: 'var(--muted)' };
  };
  const roleTag = (role: string): string => {
    const k = roleKeyOf(sport, role);
    return k ?? '?';
  };

  if (allPlayers.length === 0) {
    if (squadsLoading) {
      return (
        <div className="flex items-center justify-center" style={{ height: '100dvh', paddingTop: 60 }}>
          <div className="text-center">
            <div className="text-3xl mb-3 animate-pulse">{isFootball ? '⚽' : '🏏'}</div>
            <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 16, fontWeight: 800, marginBottom: 4 }}>Loading squads...</div>
            <div className="text-[12px]" style={{ color: 'var(--muted)' }}>Fetching player data for {t1} vs {t2}</div>
          </div>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center" style={{ height: '100dvh', paddingTop: 60 }}>
        <div className="text-center" style={{ maxWidth: 360, padding: '0 24px' }}>
          <div className="text-3xl mb-3">{isFootball ? '⚽' : '🏏'}</div>
          <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 16, fontWeight: 800, marginBottom: 6 }}>Squads not available yet</div>
          <div className="text-[12px]" style={{ color: 'var(--muted)', lineHeight: 1.5, marginBottom: 16 }}>
            We don't have player data for {t1} vs {t2} yet. Try again in a moment, or ask an admin to sync the squad.
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: '8px 18px', fontSize: 12, fontWeight: 700, borderRadius: 7, background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border)', cursor: 'pointer' }}
          >
            Reload
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingTop: 60, height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* ── TOP BAR ── */}
      {(() => {
        const roleChips = (
          <div style={{ fontSize: isMobile ? 10 : 11, color: 'var(--muted)', display: 'flex', gap: isMobile ? 6 : 8, fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 700, flexWrap: 'wrap' }}>
            {PRIMARY_ROLES.map(k => {
              const at = activeRoleCounts[k] || 0;
              const pair = ROLE_CAPS_PAIRS[k];
              if (!pair) return null;
              const [lo, hi] = pair;
              const over = at > hi;
              const under = at < lo;
              const full = at === hi;
              const color = over ? 'var(--red)' : under ? 'var(--red)' : full ? 'var(--amber)' : 'var(--muted)';
              return (
                <span key={k} style={{ color }}>
                  {k} {at}/{hi}{under && lo > 0 ? ` (need ${lo})` : ''}
                </span>
              );
            })}
            {wkRequired && (
              <span style={{ color: wkValid ? 'var(--green)' : 'var(--red)' }}>
                WK {activeRoleCounts['WK' as RoleKey] || 0}{wkValid ? '' : ` (need ${MIN_WK})`}
              </span>
            )}
          </div>
        );
        return (
          <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg2)', flexShrink: 0 }}>
            {/* Row 1: title + counts + buttons */}
            <div style={{ minHeight: isMobile ? 44 : 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '6px 12px' : '0 24px', gap: isMobile ? 6 : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: isMobile ? 13 : 15, fontWeight: 800 }}>Build Your XI</div>
                {!isMobile && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{t1} vs {t2}</div>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 14, flexShrink: 0 }}>
                <div style={{ fontSize: isMobile ? 11 : 12, color: 'var(--muted)' }}>
                  <b style={{ fontFamily: "'Cabinet Grotesk', sans-serif", color: pickCount === 11 ? 'var(--green)' : 'var(--amber)' }}>{pickCount}</b>/11
                  <span style={{ margin: '0 4px', color: 'var(--faint)' }}>·</span>
                  <b style={{ fontFamily: "'Cabinet Grotesk', sans-serif", color: isBalanced ? 'var(--green)' : 'var(--amber)' }}>{totalUsed}</b>/33
                </div>
                {!isMobile && roleChips}
                <button onClick={onComplete} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: isMobile ? '5px 10px' : '7px 16px', fontSize: isMobile ? 11 : 12, fontWeight: 600, color: 'var(--muted)', cursor: 'pointer' }}>
                  {isMobile ? 'Room' : 'Back to room'}
                </button>
                <button onClick={handleLockTeam} disabled={!canLock || locking} style={{
                  background: 'var(--green)', color: '#071a0e', border: 'none', borderRadius: 8,
                  padding: isMobile ? '6px 14px' : '8px 22px', fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: isMobile ? 12 : 13, fontWeight: 800,
                  cursor: canLock ? 'pointer' : 'not-allowed', opacity: canLock && !locking ? 1 : 0.3,
                }}>
                  {locking ? '...' : (game?.squad_locked ? 'Save power ✓' : 'Lock ✓')}
                </button>
              </div>
            </div>
            {/* Row 2 (mobile only): role chips on their own line so the Lock button never gets pushed */}
            {isMobile && (
              <div style={{ padding: '4px 12px 6px' }}>{roleChips}</div>
            )}
          </div>
        );
      })()}

      {error && <div style={{ background: 'rgba(240,82,82,0.1)', border: '1px solid rgba(240,82,82,0.3)', padding: '8px 24px', fontSize: 12, color: 'var(--red)' }}>{error}</div>}

      {/* ── LAYOUT: BENCH + PITCH ── */}
      {isMobile ? (
        /* ══ MOBILE: Step 1 = multi-select players, Step 2 = pitch + power ══ */
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

          {mobileStep === 'pick' ? (
            /* ── STEP 1: SELECT 11 PLAYERS ── */
            <>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 15, fontWeight: 800 }}>Select 11 Players</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>Tap to select · {mobileSelected.size}/11 picked</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" style={{ width: 90, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, padding: '5px 8px', fontSize: 12, color: 'var(--text)', outline: 'none' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4, padding: '6px 12px', flexWrap: 'wrap', borderBottom: '1px solid var(--border)' }}>
                {(isFootball
                  ? [['all', 'All'], ['gk', 'GK'], ['def', 'DEF'], ['mid', 'MID'], ['fw', 'FW']]
                  : [['all', 'All'], ['bat', 'Bat'], ['bowl', 'Bowl'], ['ar', 'AR'], ['wk', 'WK']]
                ).map(([r, label]) => (
                  <button key={r} onClick={() => setRoleFilter(r)} style={{ fontSize: 11, padding: '4px 12px', borderRadius: 100, cursor: 'pointer', fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 700, border: roleFilter === r ? '1px solid rgba(45,214,122,0.25)' : '1px solid var(--border)', background: roleFilter === r ? 'rgba(45,214,122,0.08)' : 'transparent', color: roleFilter === r ? 'var(--green)' : 'var(--muted)' }}>
                    {label}
                  </button>
                ))}
              </div>
              <div style={{ flex: 1, padding: '8px 10px' }}>
                {teams.map(team => (
                  <div key={team}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: 'var(--muted)', padding: '8px 4px 5px', fontFamily: "'Cabinet Grotesk', sans-serif" }}>{team}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                      {benchPlayers.filter(p => p.team === team).map(player => {
                        const isSel = mobileSelected.has(player.player_id);
                        const rcBg = getRoleBg(player.player_role);
                        const pRole = roleKeyOf(sport, player.player_role);
                        const pRolePair = pRole ? ROLE_CAPS_PAIRS[pRole] : undefined;
                        const pRoleCap = pRolePair ? pRolePair[1] : Infinity;
                        const capExceeded = !isSel && pRole !== null && (mobileRoleCounts[pRole] || 0) >= pRoleCap;
                        const canSelect = (mobileSelected.size < 11 || isSel) && !capExceeded;
                        return (
                          <div key={player.player_id} onClick={() => canSelect && mobileTogglePlayer(player.player_id)} style={{
                            display: 'flex', alignItems: 'center', gap: 6, padding: '7px 8px', borderRadius: 8,
                            border: isSel ? '2px solid var(--green)' : '1px solid var(--border)',
                            background: isSel ? 'rgba(45,214,122,0.08)' : 'var(--surface)',
                            cursor: canSelect ? 'pointer' : 'default', opacity: canSelect ? 1 : 0.4,
                          }}>
                            {/* Checkbox */}
                            <div style={{ width: 20, height: 20, borderRadius: 5, border: isSel ? '2px solid var(--green)' : '1.5px solid var(--border)', background: isSel ? 'var(--green)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 12, color: '#071a0e', fontWeight: 900 }}>
                              {isSel ? '✓' : ''}
                            </div>
                            <PlayerAvatar name={player.player_name} imageUrl={player.image_url} size={24} radius={6} fontSize={8} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{player.player_name}</div>
                              <div style={{ fontSize: 9, fontWeight: 700, color: rcBg.color, fontFamily: "'Cabinet Grotesk', sans-serif" }}>{roleTag(player.player_role)}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Sticky bottom bar */}
              {mobileSelected.size > 0 && (
                <div style={{ position: 'sticky', bottom: 0, padding: '10px 14px', paddingBottom: 'max(10px, env(safe-area-inset-bottom))', background: 'var(--bg)', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "'Cabinet Grotesk', sans-serif" }}>
                    <span style={{ color: mobileSelected.size === 11 ? 'var(--green)' : 'var(--amber)' }}>{mobileSelected.size}</span>/11 selected
                  </div>
                  <button onClick={mobilePlaceAll} disabled={mobileSelected.size !== 11} style={{
                    background: 'var(--green)', color: '#071a0e', border: 'none', borderRadius: 9,
                    padding: '10px 24px', fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 14, fontWeight: 800,
                    cursor: mobileSelected.size === 11 ? 'pointer' : 'not-allowed',
                    opacity: mobileSelected.size === 11 ? 1 : 0.3,
                  }}>
                    Assign Power →
                  </button>
                </div>
              )}
            </>
          ) : (
            /* ── STEP 2: PITCH VIEW + POWER DISTRIBUTION ── */
            <>
              {/* Pitch with players placed (sport-aware) */}
              <div style={{ flexShrink: 0, padding: '0 8px' }}>
                <Pitch slots={slots} powers={powers} selectedPlayer={null} phase={2} onSlotClick={(i) => setActiveSlot(activeSlot === i ? null : i)} hint="" activeSlot={activeSlot} />
              </div>

              {/* Power adjuster for selected slot */}
              {activeSlot !== null && slots[activeSlot] && (() => {
                const player = slots[activeSlot]!;
                const pw = powers[activeSlot];
                const canInc = pw < MAX_B && availablePower > 0;
                const canDec = pw > MIN_B;
                return (
                  <div style={{ padding: '8px 14px', background: 'var(--surface)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>{player.player_name}</span>
                    <button onClick={() => adjustPower(activeSlot, -1)} disabled={!canDec} style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--surface2)', border: '1px solid var(--border)', color: canDec ? 'var(--text)' : 'var(--faint)', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                    <span style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 24, fontWeight: 900, color: 'var(--amber)', width: 36, textAlign: 'center' }}>{pw}x</span>
                    <button onClick={() => adjustPower(activeSlot, 1)} disabled={!canInc} style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--surface2)', border: '1px solid var(--border)', color: canInc ? 'var(--text)' : 'var(--faint)', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                  </div>
                );
              })()}

              {/* Presets + power list — sport-aware boost targets */}
              <div style={{ padding: '10px 14px' }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                  {(isFootball
                    ? [{ key: 'balanced' as const, icon: '⚖️', label: 'Balance' }, { key: 'FW' as const, icon: '⚡', label: 'Attack' }, { key: 'MID' as const, icon: '🎯', label: 'Midfield' }, { key: 'DEF' as const, icon: '🛡️', label: 'Defence' }]
                    : [{ key: 'balanced' as const, icon: '⚖️', label: 'Balance' }, { key: 'BAT' as const, icon: '🏏', label: 'Bat' }, { key: 'BOWL' as const, icon: '🎯', label: 'Bowl' }, { key: 'AR' as const, icon: '⚡', label: 'AR' }]
                  ).map(p => (
                    <button key={p.key} onClick={() => applyPreset(p.key)} style={{ padding: '5px 12px', borderRadius: 100, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--muted)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: "'Cabinet Grotesk', sans-serif" }}>{p.icon} {p.label}</button>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10 }}>Tap a player on the pitch to adjust power · <b style={{ color: isBalanced ? 'var(--green)' : 'var(--amber)' }}>{totalUsed}/33</b> used · <b>{availablePower}</b> available</div>
                <button onClick={() => setMobileStep('pick')} style={{
                  width: '100%', padding: '10px 16px', borderRadius: 9,
                  border: '1px solid var(--border)', background: 'var(--surface)',
                  color: 'var(--text)', fontSize: 13, fontWeight: 700,
                  fontFamily: "'Cabinet Grotesk', sans-serif", cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                  ← Back to player selection
                </button>
              </div>

              {/* Locked confirmation + Go to room CTA */}
              {game?.squad_locked && (
                <div style={{ padding: '12px 14px 18px' }}>
                  <div style={{
                    background: 'rgba(45,214,122,0.08)', border: '1px solid rgba(45,214,122,0.3)',
                    borderRadius: 10, padding: '10px 14px', marginBottom: 10,
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <div style={{ fontSize: 18 }}>🔒</div>
                    <div>
                      <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 13, fontWeight: 800, color: 'var(--green)' }}>Your team is now locked</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Head to the room to start playing</div>
                    </div>
                  </div>
                  <button
                    onClick={onComplete}
                    style={{
                      width: '100%', background: 'var(--green)', color: '#071a0e', border: 'none', borderRadius: 12,
                      padding: '14px 20px', fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 15, fontWeight: 800,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    }}
                  >
                    Go to room →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
      /* ══ DESKTOP: side-by-side layout ══ */
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '340px 1fr', overflow: 'hidden' }}>

        {/* ══ LEFT: BENCH ══ */}
        <div style={{ borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg2)' }}>
          <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 15, fontWeight: 800 }}>Player bench</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Click player · click field</div>
            </div>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" style={{ width: 120, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 10px', fontSize: 13, color: 'var(--text)', outline: 'none' }} />
          </div>
          <div style={{ display: 'flex', gap: 4, padding: '6px 14px', flexShrink: 0, flexWrap: 'wrap', borderBottom: '1px solid var(--border)' }}>
            {(isFootball
              ? [['all', 'All'], ['gk', 'GK'], ['def', 'DEF'], ['mid', 'MID'], ['fw', 'FW']]
              : [['all', 'All'], ['bat', 'Bat'], ['bowl', 'Bowl'], ['ar', 'AR'], ['wk', 'WK']]
            ).map(([r, label]) => (
              <button key={r} onClick={() => setRoleFilter(r)} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 100, cursor: 'pointer', fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 700, border: roleFilter === r ? '1px solid rgba(45,214,122,0.25)' : '1px solid var(--border)', background: roleFilter === r ? 'rgba(45,214,122,0.08)' : 'transparent', color: roleFilter === r ? 'var(--green)' : 'var(--muted)' }}>
                {label}
              </button>
            ))}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
            {teams.map(team => (
              <div key={team}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: 'var(--muted)', padding: '8px 4px 5px', fontFamily: "'Cabinet Grotesk', sans-serif" }}>{team}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                  {benchPlayers.filter(p => p.team === team).map(player => {
                    const isPlaced = placedIds.has(player.player_id);
                    const isSel = selectedPlayer?.player_id === player.player_id;
                    const rcBg = getRoleBg(player.player_role);
                    const fullName = player.player_name;
                    const pRole = roleKeyOf(sport, player.player_role);
                    const pRolePair = pRole ? ROLE_CAPS_PAIRS[pRole] : undefined;
                    const pRoleCap = pRolePair ? pRolePair[1] : Infinity;
                    const capExceeded = !isPlaced && pRole !== null && (roleCounts[pRole] || 0) >= pRoleCap;
                    const disabled = isPlaced || capExceeded;
                    return (
                      <div key={player.player_id} onClick={() => !disabled && handleBenchClick(player)} title={capExceeded ? `Max ${pRoleCap} ${pRole} allowed` : undefined} style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '6px 8px', borderRadius: 8,
                        border: isSel ? '1px solid var(--green)' : '1px solid var(--border)',
                        background: isSel ? 'rgba(45,214,122,0.05)' : 'var(--surface)',
                        cursor: disabled ? 'default' : 'pointer',
                        opacity: isPlaced ? 0.25 : capExceeded ? 0.4 : 1,
                        pointerEvents: disabled ? 'none' : 'auto',
                        transition: 'all 0.15s',
                      }}>
                        <PlayerAvatar name={player.player_name} imageUrl={player.image_url} size={28} radius={7} fontSize={10} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fullName}</div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: rcBg.color, fontFamily: "'Cabinet Grotesk', sans-serif" }}>{roleTag(player.player_role)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ══ PITCH + POWER STRIP ══ */}
        <div style={{ display: 'flex', overflow: 'hidden', position: 'relative', flex: 1 }}>

          {/* Pitch area */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
            {/* Preset buttons floating on top — sport-aware boost groups */}
            {pickCount > 0 && (
              <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 20, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 4, background: 'rgba(26,27,30,0.85)', backdropFilter: 'blur(8px)', borderRadius: 14, padding: '5px 8px', border: '1px solid var(--border)' }}>
                {(isFootball
                  ? [
                      { key: 'balanced' as const, icon: '⚖️', label: 'Balance' },
                      { key: 'FW' as const, icon: '⚡', label: 'Attack' },
                      { key: 'MID' as const, icon: '🎯', label: 'Midfield' },
                      { key: 'DEF' as const, icon: '🛡️', label: 'Defence' },
                    ]
                  : [
                      { key: 'balanced' as const, icon: '⚖️', label: 'Balance' },
                      { key: 'BAT' as const, icon: '🏏', label: 'Batters' },
                      { key: 'BOWL' as const, icon: '🎯', label: 'Bowlers' },
                      { key: 'AR' as const, icon: '⚡', label: 'All-rds' },
                    ]
                ).map(p => (
                  <button key={p.key} onClick={() => applyPreset(p.key)} style={{
                    padding: '4px 10px', borderRadius: 100, border: 'none', background: 'transparent',
                    color: 'var(--muted)', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    fontFamily: "'Cabinet Grotesk', sans-serif", whiteSpace: 'nowrap',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--amber)'; e.currentTarget.style.background = 'rgba(245,158,11,0.08)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'transparent'; }}
                  >
                    {p.icon} {p.label}
                  </button>
                ))}
              </div>
            )}

            {/* Pitch (sport-aware: Cricket or Football) */}
            <Pitch
              slots={slots}
              powers={powers}
              selectedPlayer={selectedPlayer}
              phase={1}
              onSlotClick={handleSlotClick}
              hint={activeSlot !== null ? 'TAP PLAYER TO ADJUST POWER · TAP AGAIN TO REMOVE' : 'CLICK PLAYER · THEN CLICK A POSITION'}
              activeSlot={activeSlot}
            />

            {/* Locked confirmation + Go to room CTA — anchored to the bottom-right
                on desktop so it doesn't overlap the lower pitch fielders
                (Padikkal / Salam). Stays clear of the floating power strip,
                which is vertically centered on the right edge. */}
            {game?.squad_locked && (
              <div style={{
                position: 'absolute', bottom: 20, right: 24, zIndex: 25,
                display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 10,
                background: 'rgba(26,27,30,0.95)', backdropFilter: 'blur(8px)',
                border: '1px solid rgba(45,214,122,0.3)', borderRadius: 14, padding: 14,
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                maxWidth: 260,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 18 }}>🔒</div>
                  <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 14, fontWeight: 800, color: 'var(--green)' }}>Your team is now locked</div>
                </div>
                <button
                  onClick={onComplete}
                  style={{
                    background: 'var(--green)', color: '#071a0e', border: 'none', borderRadius: 12,
                    padding: '12px 22px', fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 14, fontWeight: 800,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    boxShadow: '0 8px 24px rgba(45,214,122,0.35)',
                  }}
                >
                  Go to room →
                </button>
              </div>
            )}
          </div>

          {/* Floating vertical power strip — between pitch and right edge */}
          {activeSlot !== null && slots[activeSlot] && (() => {
            const player = slots[activeSlot]!;
            const pw = powers[activeSlot];
            const maxed = pw >= MAX_B;
            const minned = pw <= MIN_B;
            const canIncrease = pw < MAX_B && availablePower > 0;
            const canDecrease = pw > MIN_B;

            return (
              <div style={{
                position: 'absolute', right: 24, top: '50%', transform: 'translateY(-50%)', zIndex: 30,
                width: 80, background: 'rgba(33,34,38,0.95)', backdropFilter: 'blur(12px)',
                border: '1px solid var(--border2)', borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '14px 8px', gap: 8,
              }}>
                {/* Close button */}
                <button onClick={() => setActiveSlot(null)} style={{
                  width: 24, height: 24, borderRadius: 6, background: 'var(--surface)', border: '1px solid var(--border)',
                  color: 'var(--muted)', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  alignSelf: 'flex-end', lineHeight: 1,
                }}>×</button>

                {/* Player avatar */}
                <PlayerAvatar name={player.player_name} imageUrl={player.image_url} size={40} radius={10} fontSize={12} />

                {/* Player name */}
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', textAlign: 'center', lineHeight: 1.2, fontFamily: "'Cabinet Grotesk', sans-serif" }}>
                  {player.player_name.split(' ').pop()}
                </div>

                {/* Available power */}
                <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 600 }}>
                  {availablePower} avail
                </div>

                {/* + button */}
                <button onClick={() => adjustPower(activeSlot, 1)} disabled={!canIncrease} style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: canIncrease ? 'var(--surface2)' : 'var(--surface)',
                  border: '1px solid var(--border)', color: canIncrease ? 'var(--text)' : 'var(--faint)',
                  fontSize: 20, fontWeight: 700, cursor: canIncrease ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>+</button>

                {/* Power value */}
                <div style={{
                  fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 32, fontWeight: 900,
                  color: maxed ? 'var(--red)' : minned ? 'var(--blue)' : 'var(--amber)',
                  lineHeight: 1,
                }}>
                  {pw}<span style={{ fontSize: 14, fontWeight: 700 }}>x</span>
                </div>

                {/* - button */}
                <button onClick={() => adjustPower(activeSlot, -1)} disabled={!canDecrease} style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: canDecrease ? 'var(--surface2)' : 'var(--surface)',
                  border: '1px solid var(--border)', color: canDecrease ? 'var(--text)' : 'var(--faint)',
                  fontSize: 20, fontWeight: 700, cursor: canDecrease ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>−</button>

                {/* Spacer */}
                <div style={{ flex: 1 }} />

                {/* Remove button */}
                <button onClick={() => {
                  const updated = [...slots]; updated[activeSlot] = null; setSlots(updated);
                  const newPw = [...powers]; newPw[activeSlot] = DEF_B; setPowers(newPw);
                  setActiveSlot(null);
                }} style={{
                  fontSize: 9, fontWeight: 700, padding: '6px 8px', borderRadius: 6, width: '100%',
                  background: 'rgba(240,82,82,0.08)', color: 'var(--red)', border: '1px solid rgba(240,82,82,0.2)',
                  cursor: 'pointer', textAlign: 'center',
                }}>
                  Remove
                </button>
              </div>
            );
          })()}
        </div>
      </div>
      )}
    </div>
  );
}
