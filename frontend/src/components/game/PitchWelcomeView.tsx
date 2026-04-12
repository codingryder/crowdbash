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
  const [roleFilter, setRoleFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [locking, setLocking] = useState(false);
  const [error, setError] = useState('');
  const [initialized, setInitialized] = useState(false);

  const [t1, t2] = splitTeams(roomName);

  useEffect(() => { fetchSquads(); }, []);

  // Pre-populate slots from existing game state (when editing)
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
        if (player) {
          newSlots[i] = player;
          newPowers[i] = pw.weightage || DEF_B;
        }
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

  // Filter bench players
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
  }

  function handleSlotClick(index: number) {
    if (slots[index]) {
      const updated = [...slots];
      updated[index] = null;
      setSlots(updated);
      const pw = [...powers]; pw[index] = DEF_B; setPowers(pw);
    } else if (selectedPlayer) {
      const updated = [...slots];
      updated[index] = selectedPlayer;
      setSlots(updated);
      setSelectedPlayer(null);
    }
  }

  function setPower(idx: number, newVal: number) {
    newVal = Math.max(MIN_B, Math.min(MAX_B, newVal));
    const delta = newVal - powers[idx];
    if (!delta) return;
    const pw = [...powers];
    pw[idx] = newVal;
    if (delta > 0) {
      let remaining = delta;
      for (let s = 0; s < 50 && remaining > 0; s++) {
        let ri = -1, rv = MIN_B;
        for (let i = 0; i < 11; i++) { if (i !== idx && slots[i] && pw[i] > rv) { rv = pw[i]; ri = i; } }
        if (ri === -1) { pw[idx] -= remaining; break; }
        const take = Math.min(remaining, pw[ri] - MIN_B); pw[ri] -= take; remaining -= take;
      }
    } else {
      let surplus = -delta;
      for (let s = 0; s < 50 && surplus > 0; s++) {
        let pi = -1, pv = MAX_B;
        for (let i = 0; i < 11; i++) { if (i !== idx && slots[i] && pw[i] < pv) { pv = pw[i]; pi = i; } }
        if (pi === -1) { pw[idx] += surplus; break; }
        const give = Math.min(surplus, MAX_B - pw[pi]); pw[pi] += give; surplus -= give;
      }
    }
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
      const roleMap: Record<string, string> = { top3bat: 'bat', bowlers: 'bowl', allrounder: 'all' };
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
  }

  async function handleLockTeam() {
    if (!canLock) return;
    setLocking(true);
    setError('');
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
    } finally {
      setLocking(false);
    }
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
    if (r.includes('bat')) return 'BAT';
    if (r.includes('bowl')) return 'BOWL';
    if (r.includes('all')) return 'AR';
    if (r.includes('keep') || r.includes('wk')) return 'WK';
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
            <b style={{ fontFamily: "'Cabinet Grotesk', sans-serif", color: pickCount === 11 ? 'var(--green)' : 'var(--amber)' }}>{pickCount}</b>/11 picked
            <span style={{ margin: '0 8px', color: 'var(--faint)' }}>·</span>
            <b style={{ fontFamily: "'Cabinet Grotesk', sans-serif", color: isBalanced ? 'var(--green)' : 'var(--amber)' }}>{totalUsed}</b>/33 power
          </div>
          <button onClick={onComplete} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 16px', fontSize: 12, fontWeight: 600, color: 'var(--muted)', cursor: 'pointer' }}>
            Back to room
          </button>
          <button
            onClick={handleLockTeam}
            disabled={!canLock || locking}
            style={{
              background: 'var(--green)', color: '#071a0e', border: 'none', borderRadius: 8,
              padding: '8px 22px', fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 13, fontWeight: 800,
              cursor: canLock ? 'pointer' : 'not-allowed', transition: 'all 0.15s',
              opacity: canLock && !locking ? 1 : 0.3,
            }}
          >
            {locking ? 'Locking...' : 'Lock Team ✓'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(240,82,82,0.1)', border: '1px solid rgba(240,82,82,0.3)', padding: '8px 24px', fontSize: 12, color: 'var(--red)' }}>{error}</div>
      )}

      {/* ── 3-COLUMN BODY ── */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '252px 1fr 252px', overflow: 'hidden' }}>

        {/* ══ LEFT: BENCH ══ */}
        <div style={{ borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg2)' }}>
          <div style={{ padding: '13px 15px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 13, fontWeight: 800, marginBottom: 1 }}>Player bench</div>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>Click player · click field position</div>
          </div>
          <div style={{ padding: '8px 15px', flexShrink: 0 }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search player…" style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', fontSize: 12, color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'flex', gap: 4, padding: '0 15px 8px', flexShrink: 0, flexWrap: 'wrap' }}>
            {['all', 'bat', 'bowl', 'ar', 'wk'].map(r => (
              <button key={r} onClick={() => setRoleFilter(r)} style={{ fontSize: 10, padding: '3px 9px', borderRadius: 100, cursor: 'pointer', fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 700, border: roleFilter === r ? '1px solid rgba(45,214,122,0.25)' : '1px solid var(--border)', background: roleFilter === r ? 'rgba(45,214,122,0.08)' : 'transparent', color: roleFilter === r ? 'var(--green)' : 'var(--muted)' }}>
                {r === 'all' ? 'All' : r === 'bat' ? 'Bat' : r === 'bowl' ? 'Bowl' : r === 'ar' ? 'AR' : 'WK'}
              </button>
            ))}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 15px 15px' }}>
            {teams.map(team => (
              <div key={team}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: 'var(--muted)', padding: '8px 0 4px', fontFamily: "'Cabinet Grotesk', sans-serif" }}>{team}</div>
                {benchPlayers.filter(p => p.team === team).map(player => {
                  const isPlaced = placedIds.has(player.player_id);
                  const isSel = selectedPlayer?.player_id === player.player_id;
                  const rcBg = getRoleBg(player.player_role);
                  const initials = player.player_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                  return (
                    <div key={player.player_id} onClick={() => !isPlaced && handleBenchClick(player)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 9, border: isSel ? '1px solid var(--green)' : '1px solid var(--border)', background: isSel ? 'rgba(45,214,122,0.05)' : 'var(--surface)', marginBottom: 5, cursor: isPlaced ? 'default' : 'pointer', opacity: isPlaced ? 0.28 : 1, pointerEvents: isPlaced ? 'none' : 'auto' }}>
                      <div style={{ width: 30, height: 30, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 9, fontWeight: 700, flexShrink: 0, ...rcBg }}>{initials}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{player.player_name}</div>
                        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>{player.team.split(' ').pop()}</div>
                      </div>
                      <span style={{ fontSize: 9, fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 700, borderRadius: 3, padding: '1px 5px', flexShrink: 0, ...rcBg }}>{roleTag(player.player_role)}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* ══ CENTER: FIELD ══ */}
        <CricketPitch slots={slots} powers={powers} selectedPlayer={selectedPlayer} phase={1} onSlotClick={handleSlotClick} hint="CLICK PLAYER · THEN CLICK A POSITION" />

        {/* ══ RIGHT: POWER PANEL ══ */}
        <div style={{ borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg2)' }}>
          <div style={{ padding: '13px 15px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 13, fontWeight: 800, marginBottom: 1 }}>Power distribution</div>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>33 total · max 6x · min 1x</div>
          </div>
          <div style={{ padding: '10px 15px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <div style={{ height: 4, background: 'var(--faint)', borderRadius: 2, overflow: 'hidden', marginBottom: 5 }}>
              <div style={{ height: '100%', borderRadius: 2, width: pickCount ? `${Math.round(totalUsed / TOTAL_B * 100)}%` : '0%', background: isBalanced ? 'var(--green)' : 'var(--amber)', transition: 'width 0.3s' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--muted)', fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 600 }}>
              <span>Assigned: <b style={{ color: isBalanced ? 'var(--green)' : 'var(--amber)' }}>{totalUsed}</b>/33</span>
              <span>{pickCount < 11 ? 'Pick players first' : isBalanced ? 'Balanced ✓' : `${TOTAL_B - totalUsed} unassigned`}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 5, padding: '8px 15px', borderBottom: '1px solid var(--border)', flexShrink: 0, flexWrap: 'wrap' }}>
            {[{ key: 'balanced', icon: '⚖️', label: 'Reset' }, { key: 'top3bat', icon: '🏏', label: 'Batters' }, { key: 'bowlers', icon: '🎯', label: 'Bowlers' }, { key: 'allrounder', icon: '⚡', label: 'All-rds' }].map(p => (
              <button key={p.key} onClick={() => applyPreset(p.key)} style={{ padding: '4px 9px', borderRadius: 100, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: "'Cabinet Grotesk', sans-serif" }}>
                {p.icon} {p.label}
              </button>
            ))}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 15px' }}>
            {pickCount === 0 && (
              <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--muted)', fontSize: 12 }}>
                Place players on the pitch to assign power
              </div>
            )}
            {slots.map((player, i) => {
              if (!player) return null;
              const pw = powers[i];
              const maxed = pw >= MAX_B;
              const minned = pw <= MIN_B;
              const pct = ((pw - MIN_B) / (MAX_B - MIN_B) * 100).toFixed(1);
              const rcBg = getRoleBg(player.player_role);
              const initials = player.player_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
              return (
                <div key={player.player_id} style={{ background: 'var(--surface)', border: `1px solid ${maxed ? 'rgba(240,82,82,0.22)' : 'var(--border)'}`, borderRadius: 10, padding: '9px 12px', marginBottom: 7 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
                    <div style={{ width: 26, height: 26, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 8, fontWeight: 700, flexShrink: 0, ...rcBg }}>{initials}</div>
                    <div style={{ flex: 1, fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{player.player_name.split(' ').pop()}</div>
                    <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 15, fontWeight: 900, minWidth: 24, textAlign: 'right', color: maxed ? 'var(--red)' : minned ? 'var(--blue)' : 'var(--amber)' }}>{pw}x</div>
                  </div>
                  <div style={{ position: 'relative', height: 24, display: 'flex', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
                    onMouseDown={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const handle = (clientX: number) => { const pctX = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)); setPower(i, Math.round(MIN_B + pctX * (MAX_B - MIN_B))); };
                      handle(e.clientX);
                      const move = (ev: MouseEvent) => handle(ev.clientX);
                      const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
                      window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
                    }}
                  >
                    <div style={{ position: 'absolute', left: 0, right: 0, height: 5, background: 'var(--faint)', borderRadius: 3 }} />
                    <div style={{ position: 'absolute', left: 0, height: 5, borderRadius: 3, width: `${pct}%`, background: maxed ? 'var(--red)' : minned ? 'var(--blue)' : 'var(--amber)', transition: 'width 0.12s', pointerEvents: 'none' }} />
                    <div style={{ position: 'absolute', left: `${pct}%`, width: 18, height: 18, borderRadius: '50%', border: '2.5px solid rgba(0,0,0,0.35)', transform: 'translateX(-50%)', pointerEvents: 'none', background: maxed ? 'var(--red)' : minned ? 'var(--blue)' : 'var(--amber)' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
