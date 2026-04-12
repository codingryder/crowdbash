import { useState, useEffect } from 'react';
import { CricketPitch, CRICKET_POSITIONS } from './CricketPitch';
import { FootballPitch, FOOTBALL_POSITIONS } from './FootballPitch';
import { PlayerSelectorSheet } from './PlayerSelectorSheet';
import { useGameStore } from '../../store/gameStore';
import { useGame } from '../../hooks/useGame';
import type { Sport, SquadPlayer } from '../../types';
import { splitTeams } from '../../types';

interface PitchWelcomeViewProps {
  roomId: string;
  roomName: string;
  sport: Sport;
  onComplete: () => void; // called after squad is locked
}

export function PitchWelcomeView({ roomId, roomName, sport, onComplete }: PitchWelcomeViewProps) {
  const { selectSquad, saveWeightages, lockSquad, fetchSquads } = useGame(roomId);
  const availableSquads = useGameStore(s => s.availableSquads);

  const [step, setStep] = useState<'pitch' | 'power'>('pitch');
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [activePosition, setActivePosition] = useState<string | null>(null);
  const [powers, setPowers] = useState<Record<string, number>>({});
  const [locking, setLocking] = useState(false);
  const [saving, setSaving] = useState(false);

  const [t1, t2] = splitTeams(roomName);

  // Fetch squads on mount
  useEffect(() => { fetchSquads(); }, []);

  // Flatten all players
  const allPlayers: SquadPlayer[] = Object.values(availableSquads || {}).flat();
  const positions = sport === 'football' ? FOOTBALL_POSITIONS : CRICKET_POSITIONS;
  const selectedCount = Object.keys(assignments).length;
  const assignedPlayerIds = new Set(Object.values(assignments));
  const isFull = selectedCount === 11;

  // Find position info for active position
  const activePos = positions.find(p => p.key === activePosition);

  function assignPlayer(positionKey: string, playerId: string) {
    const updated = { ...assignments };
    // Remove player from any other position
    for (const [k, v] of Object.entries(updated)) {
      if (v === playerId) delete updated[k];
    }
    updated[positionKey] = playerId;
    setAssignments(updated);
    setActivePosition(null);
  }

  function removeFromPosition(positionKey: string) {
    const updated = { ...assignments };
    delete updated[positionKey];
    setAssignments(updated);
    setActivePosition(null);
  }

  async function handleConfirmSquad() {
    const playerIds = Object.values(assignments);
    setSaving(true);
    try {
      await selectSquad(playerIds);
      // Initialize equal powers
      const initial: Record<string, number> = {};
      playerIds.forEach((id, i) => { initial[id] = i < 11 ? 3 : 0; });
      setPowers(initial);
      setStep('power');
    } catch (e) {
      console.error('Failed to select squad', e);
    } finally {
      setSaving(false);
    }
  }

  async function handleLock() {
    setLocking(true);
    try {
      const weightages = Object.entries(powers).map(([player_id, weightage]) => ({ player_id, weightage }));
      await saveWeightages(weightages);
      await lockSquad();
      onComplete();
    } catch (e) {
      console.error('Failed to lock squad', e);
    } finally {
      setLocking(false);
    }
  }

  function adjustPower(playerId: string, delta: number) {
    const current = powers[playerId] || 0;
    const newVal = Math.max(0, Math.min(6, current + delta));
    const totalUsed = Object.values(powers).reduce((s, v) => s + v, 0) - current + newVal;
    if (totalUsed > 33) return; // budget exceeded
    setPowers({ ...powers, [playerId]: newVal });
  }

  const totalPower = Object.values(powers).reduce((s, v) => s + v, 0);

  if (allPlayers.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height: '100vh', paddingTop: 60 }}>
        <div className="text-center">
          <div className="text-3xl mb-3 animate-pulse">🏏</div>
          <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 16, fontWeight: 800, marginBottom: 4 }}>Loading squads...</div>
          <div className="text-[12px]" style={{ color: 'var(--muted)' }}>Fetching player data for {roomName}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingTop: 60, height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      {/* Header */}
      <div className="shrink-0 px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between">
          <div>
            <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 20, fontWeight: 900, letterSpacing: '-0.5px' }}>
              {step === 'pitch' ? 'Build Your XI' : 'Assign Power'}
            </div>
            <div className="text-[12px]" style={{ color: 'var(--muted)' }}>
              {t1} vs {t2}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {step === 'pitch' && (
              <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 14, fontWeight: 800 }}>
                <span style={{ color: isFull ? 'var(--green)' : 'var(--amber)' }}>{selectedCount}</span>
                <span style={{ color: 'var(--muted)' }}>/11</span>
              </div>
            )}
            {step === 'power' && (
              <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 14, fontWeight: 800 }}>
                <span style={{ color: totalPower === 33 ? 'var(--green)' : 'var(--amber)' }}>{totalPower}</span>
                <span style={{ color: 'var(--muted)' }}>/33</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── PITCH STEP ── */}
      {step === 'pitch' && (
        <div className="flex-1 overflow-y-auto flex flex-col items-center py-6 px-4">
          {/* Pitch */}
          {sport === 'football' ? (
            <FootballPitch assignments={assignments} allPlayers={allPlayers} onPositionTap={setActivePosition} />
          ) : (
            <CricketPitch assignments={assignments} allPlayers={allPlayers} onPositionTap={setActivePosition} />
          )}

          {/* Confirm button */}
          {isFull && (
            <button
              onClick={handleConfirmSquad}
              disabled={saving}
              className="btn btn-primary mt-6"
              style={{ padding: '12px 32px', fontSize: 15, fontWeight: 800, borderRadius: 12 }}
            >
              {saving ? 'Saving...' : 'Assign Power →'}
            </button>
          )}

          {!isFull && (
            <div className="text-center mt-6 text-[12px]" style={{ color: 'var(--muted)' }}>
              Tap positions on the {sport === 'football' ? 'field' : 'pitch'} to place players
            </div>
          )}
        </div>
      )}

      {/* ── POWER STEP ── */}
      {step === 'power' && (
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Budget bar */}
          <div className="mb-4 px-3 py-3 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-[11px] font-semibold" style={{ color: 'var(--muted)' }}>Power Budget</div>
              <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 14, fontWeight: 800 }}>
                <span style={{ color: totalPower <= 33 ? 'var(--green)' : 'var(--red)' }}>{totalPower}</span>
                <span style={{ color: 'var(--muted)' }}> / 33</span>
              </div>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: 'var(--border)' }}>
              <div style={{ height: '100%', borderRadius: 2, width: `${Math.min((totalPower / 33) * 100, 100)}%`, background: totalPower <= 33 ? 'var(--green)' : 'var(--red)', transition: 'width 0.2s' }} />
            </div>
          </div>

          {/* Player power rows */}
          <div className="space-y-2">
            {Object.values(assignments).map(playerId => {
              const player = allPlayers.find(p => p.player_id === playerId);
              if (!player) return null;
              const power = powers[playerId] || 0;

              return (
                <div key={playerId} className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  {/* Player info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium truncate" style={{ color: 'var(--text)' }}>{player.player_name}</div>
                    <div className="text-[9px]" style={{ color: 'var(--muted)' }}>{player.team} · {player.player_role}</div>
                  </div>

                  {/* Power controls */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => adjustPower(playerId, -1)}
                      style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--muted)', fontSize: 16, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      −
                    </button>
                    <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 20, fontWeight: 900, width: 28, textAlign: 'center', color: power > 0 ? 'var(--amber)' : 'var(--muted)' }}>
                      {power}
                    </div>
                    <button
                      onClick={() => adjustPower(playerId, 1)}
                      style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 16, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Lock button */}
          <div className="mt-6 text-center">
            <button
              onClick={handleLock}
              disabled={locking || totalPower !== 33}
              className="btn btn-primary"
              style={{ padding: '14px 40px', fontSize: 16, fontWeight: 800, borderRadius: 12, opacity: totalPower === 33 ? 1 : 0.4 }}
            >
              {locking ? 'Locking...' : 'Lock Squad & Play'}
            </button>
            {totalPower !== 33 && (
              <div className="text-[11px] mt-2" style={{ color: 'var(--muted)' }}>
                Distribute exactly 33 power points to lock your squad
              </div>
            )}
          </div>
        </div>
      )}

      {/* Player selector sheet */}
      {activePosition && activePos && (
        <PlayerSelectorSheet
          positionLabel={activePos.label}
          suggestedRole={activePos.role || undefined}
          availablePlayers={allPlayers}
          assignedPlayerIds={assignedPlayerIds}
          currentPlayerId={assignments[activePosition]}
          onSelect={(playerId) => assignPlayer(activePosition, playerId)}
          onRemove={() => removeFromPosition(activePosition)}
          onClose={() => setActivePosition(null)}
        />
      )}
    </div>
  );
}
