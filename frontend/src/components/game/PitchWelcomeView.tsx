import { useState, useEffect } from 'react';
import { CricketPitch } from './CricketPitch';
import { useGameStore } from '../../store/gameStore';
import { useGame } from '../../hooks/useGame';
import type { Sport, SquadPlayer } from '../../types';
import { splitTeams } from '../../types';

const TOTAL_B = 33, MAX_B = 6, MIN_B = 1, DEF_B = 3;

interface PitchWelcomeViewProps {
  roomId: string;
  roomName: string;
  sport: Sport;
  onComplete: () => void;
}

export function PitchWelcomeView({ roomId, roomName, sport: _sport, onComplete }: PitchWelcomeViewProps) {
  const { selectSquad, saveWeightages, lockSquad, fetchSquads } = useGame(roomId);
  const availableSquads = useGameStore(s => s.availableSquads);
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
      selected.forEach((pw, i) => {
        if (i >= 11) return;
        const player = allP.find(p => p.player_id === pw.player_id);
        if (player) { newSlots[i] = player; newPowers[i] = pw.weightage || DEF_B; }
      });
      setSlots(newSlots);
      setPowers(newPowers);
      setInitialized(true);
    }
  }, [game, availableSquads, initialized]);

  const allPlayers: SquadPlayer[] = Object.values(availableSquads || {}).flat();
  const placedIds = new Set(slots.filter(Boolean).map(p => p!.player_id));
  const pickCount = slots.filter(Boolean).length;
  const totalUsed = powers.reduce((s, v, i) => slots[i] ? s + v : s, 0);
  const isBalanced = totalUsed === TOTAL_B;
  const canLock = pickCount === 11 && isBalanced;

  const benchPlayers = allPlayers.filter(p => {
    if (roleFilter !== 'all') {
      const r = p.player_role.toLowerCase();
      if (roleFilter === 'bat' && !r.includes('bat')) return false;
      if (roleFilter === 'bowl' && !r.includes('bowl')) return false;
      if (roleFilter === 'ar' && !r.includes('all')) return false;
      if (roleFilter === 'wk' && !r.includes('keep') && !r.includes('wk')) return false;
    }
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

  function applyPreset(key: string) {
    const placed = slots.map((p, i) => ({ p, i })).filter(x => x.p);
    if (!placed.length) return;
    const pw = [...powers];
    placed.forEach(({ i }) => { pw[i] = MIN_B; });
    if (key === 'balanced') {
      placed.forEach(({ i }) => { pw[i] = DEF_B; });
    } else {
      const roleMap: Record<string, string> = { bat: 'bat', bowl: 'bowl', ar: 'all' };
      const targetRole = roleMap[key] || '';
      const targets = placed.filter(x => x.p!.player_role.toLowerCase().includes(targetRole));
      let budget = TOTAL_B - (placed.length * MIN_B);
      targets.forEach(({ i }) => { const add = Math.min(MAX_B - MIN_B, budget); pw[i] += add; budget -= add; });
      let extra = TOTAL_B - pw.reduce((s, v, i) => slots[i] ? s + v : s, 0);
      placed.filter(x => !x.p!.player_role.toLowerCase().includes(targetRole)).forEach(({ i }) => {
        if (extra <= 0) return; const add = Math.min(MAX_B - pw[i], extra); pw[i] += add; extra -= add;
      });
    }
    setPowers(pw);
    setActiveSlot(null);
  }

  async function handleLockTeam() {
    if (!canLock) return;
    setLocking(true); setError('');
    try {
      const playerIds = slots.filter(Boolean).map(p => p!.player_id);
      await selectSquad(playerIds);
      const weightages = slots.map((p, i) => p ? { player_id: p.player_id, weightage: powers[i] } : null).filter(Boolean) as Array<{ player_id: string; weightage: number }>;
      await saveWeightages(weightages);
      await lockSquad();
      onComplete();
    } catch (e) {
      console.error('Failed to lock team', e);
      setError('Failed to save team. Please try again.');
    } finally { setLocking(false); }
  }

  const getRoleBg = (role: string) => {
    const r = role.toLowerCase();
    if (r.includes('bat')) return { bg: 'rgba(45,214,122,0.1)', color: 'var(--green)' };
    if (r.includes('bowl')) return { bg: 'rgba(139,92,246,0.1)', color: 'var(--purple)' };
    if (r.includes('all')) return { bg: 'rgba(245,158,11,0.1)', color: 'var(--amber)' };
    return { bg: 'rgba(192,194,200,0.08)', color: 'var(--muted)' };
  };
  const roleTag = (role: string) => {
    const r = role.toLowerCase();
    if (r.includes('bat')) return 'BAT'; if (r.includes('bowl')) return 'BOWL';
    if (r.includes('all')) return 'AR'; if (r.includes('keep') || r.includes('wk')) return 'WK';
    return '?';
  };

  if (allPlayers.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height: '100vh', paddingTop: 60 }}>
        <div className="text-center">
          <div className="text-3xl mb-3 animate-pulse">🏏</div>
          <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 16, fontWeight: 800, marginBottom: 4 }}>Loading squads...</div>
          <div className="text-[12px]" style={{ color: 'var(--muted)' }}>Fetching player data for {t1} vs {t2}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingTop: 60, height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* ── TOP BAR ── */}
      <div style={{ height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 15, fontWeight: 800 }}>Build Your XI</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>{t1} vs {t2}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            <b style={{ fontFamily: "'Cabinet Grotesk', sans-serif", color: pickCount === 11 ? 'var(--green)' : 'var(--amber)' }}>{pickCount}</b>/11
            <span style={{ margin: '0 6px', color: 'var(--faint)' }}>·</span>
            <b style={{ fontFamily: "'Cabinet Grotesk', sans-serif", color: isBalanced ? 'var(--green)' : 'var(--amber)' }}>{totalUsed}</b>/33 power
          </div>
          <button onClick={onComplete} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 16px', fontSize: 12, fontWeight: 600, color: 'var(--muted)', cursor: 'pointer' }}>
            Back to room
          </button>
          <button onClick={handleLockTeam} disabled={!canLock || locking} style={{
            background: 'var(--green)', color: '#071a0e', border: 'none', borderRadius: 8,
            padding: '8px 22px', fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 13, fontWeight: 800,
            cursor: canLock ? 'pointer' : 'not-allowed', opacity: canLock && !locking ? 1 : 0.3,
          }}>
            {locking ? 'Locking...' : 'Lock Team ✓'}
          </button>
        </div>
      </div>

      {error && <div style={{ background: 'rgba(240,82,82,0.1)', border: '1px solid rgba(240,82,82,0.3)', padding: '8px 24px', fontSize: 12, color: 'var(--red)' }}>{error}</div>}

      {/* ── 2-COLUMN: BENCH + PITCH ── */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '340px 1fr', overflow: 'hidden' }}>

        {/* ══ LEFT: BENCH (2-column compact grid) ══ */}
        <div style={{ borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg2)' }}>
          <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 15, fontWeight: 800 }}>Player bench</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Click player · click field</div>
            </div>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" style={{ width: 120, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 10px', fontSize: 13, color: 'var(--text)', outline: 'none' }} />
          </div>
          <div style={{ display: 'flex', gap: 4, padding: '6px 14px', flexShrink: 0, flexWrap: 'wrap', borderBottom: '1px solid var(--border)' }}>
            {['all', 'bat', 'bowl', 'ar', 'wk'].map(r => (
              <button key={r} onClick={() => setRoleFilter(r)} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 100, cursor: 'pointer', fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 700, border: roleFilter === r ? '1px solid rgba(45,214,122,0.25)' : '1px solid var(--border)', background: roleFilter === r ? 'rgba(45,214,122,0.08)' : 'transparent', color: roleFilter === r ? 'var(--green)' : 'var(--muted)' }}>
                {r === 'all' ? 'All' : r === 'bat' ? 'Bat' : r === 'bowl' ? 'Bowl' : r === 'ar' ? 'AR' : 'WK'}
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
                    const initials = player.player_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                    const lastName = player.player_name.split(' ').pop() || player.player_name;
                    return (
                      <div key={player.player_id} onClick={() => !isPlaced && handleBenchClick(player)} style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '6px 8px', borderRadius: 8,
                        border: isSel ? '1px solid var(--green)' : '1px solid var(--border)',
                        background: isSel ? 'rgba(45,214,122,0.05)' : 'var(--surface)',
                        cursor: isPlaced ? 'default' : 'pointer',
                        opacity: isPlaced ? 0.25 : 1,
                        pointerEvents: isPlaced ? 'none' : 'auto',
                        transition: 'all 0.15s',
                      }}>
                        <div style={{ width: 28, height: 28, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 10, fontWeight: 700, flexShrink: 0, ...rcBg }}>{initials}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lastName}</div>
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

        {/* ══ RIGHT: PITCH + VERTICAL POWER STRIP ══ */}
        <div style={{ display: 'flex', overflow: 'hidden', position: 'relative' }}>

          {/* Pitch area */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
            {/* Preset buttons floating on top */}
            {pickCount > 0 && (
              <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 20, display: 'flex', gap: 6, background: 'rgba(26,27,30,0.85)', backdropFilter: 'blur(8px)', borderRadius: 100, padding: '4px 6px', border: '1px solid var(--border)' }}>
                {[
                  { key: 'balanced', icon: '⚖️', label: 'Balance' },
                  { key: 'bat', icon: '🏏', label: 'Batters' },
                  { key: 'bowl', icon: '🎯', label: 'Bowlers' },
                  { key: 'ar', icon: '⚡', label: 'All-rds' },
                ].map(p => (
                  <button key={p.key} onClick={() => applyPreset(p.key)} style={{
                    padding: '5px 12px', borderRadius: 100, border: 'none', background: 'transparent',
                    color: 'var(--muted)', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    fontFamily: "'Cabinet Grotesk', sans-serif", transition: 'all 0.15s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--amber)'; e.currentTarget.style.background = 'rgba(245,158,11,0.08)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'transparent'; }}
                  >
                    {p.icon} {p.label}
                  </button>
                ))}
              </div>
            )}

            {/* Cricket pitch */}
            <CricketPitch
              slots={slots}
              powers={powers}
              selectedPlayer={selectedPlayer}
              phase={1}
              onSlotClick={handleSlotClick}
              hint={activeSlot !== null ? 'TAP PLAYER TO ADJUST POWER · TAP AGAIN TO REMOVE' : 'CLICK PLAYER · THEN CLICK A POSITION'}
              activeSlot={activeSlot}
            />
          </div>

          {/* Floating vertical power strip — between pitch and right edge */}
          {activeSlot !== null && slots[activeSlot] && (() => {
            const player = slots[activeSlot]!;
            const pw = powers[activeSlot];
            const maxed = pw >= MAX_B;
            const minned = pw <= MIN_B;
            const canIncrease = pw < MAX_B && availablePower > 0;
            const canDecrease = pw > MIN_B;
            const rcBg = getRoleBg(player.player_role);
            const initials = player.player_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

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
                <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 12, fontWeight: 700, ...rcBg }}>
                  {initials}
                </div>

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
    </div>
  );
}
