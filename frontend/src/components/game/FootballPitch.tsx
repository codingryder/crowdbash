import type { SquadPlayer } from '../../types';

const POSITIONS = [
  { key: 'gk', label: 'GK', top: 90, left: 50, role: 'GK' },
  { key: 'lb', label: 'LB', top: 72, left: 15, role: 'DEF' },
  { key: 'cb1', label: 'CB', top: 72, left: 38, role: 'DEF' },
  { key: 'cb2', label: 'CB', top: 72, left: 62, role: 'DEF' },
  { key: 'rb', label: 'RB', top: 72, left: 85, role: 'DEF' },
  { key: 'lm', label: 'LM', top: 48, left: 20, role: 'MID' },
  { key: 'cm', label: 'CM', top: 48, left: 50, role: 'MID' },
  { key: 'rm', label: 'RM', top: 48, left: 80, role: 'MID' },
  { key: 'lw', label: 'LW', top: 22, left: 20, role: 'FWD' },
  { key: 'st', label: 'ST', top: 22, left: 50, role: 'FWD' },
  { key: 'rw', label: 'RW', top: 22, left: 80, role: 'FWD' },
];

interface FootballPitchProps {
  assignments: Record<string, string>;
  allPlayers: SquadPlayer[];
  onPositionTap: (positionKey: string) => void;
}

export function FootballPitch({ assignments, allPlayers, onPositionTap }: FootballPitchProps) {
  const playerMap = Object.fromEntries(allPlayers.map(p => [p.player_id, p]));

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 360, aspectRatio: '0.65 / 1', margin: '0 auto' }}>
      {/* Field */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 14,
        background: 'linear-gradient(180deg, rgba(45,214,122,0.05), rgba(45,214,122,0.02))',
        border: '1.5px solid rgba(45,214,122,0.12)',
      }} />

      {/* Halfway line */}
      <div style={{ position: 'absolute', top: '50%', left: '10%', right: '10%', height: 1, background: 'rgba(45,214,122,0.1)' }} />

      {/* Center circle */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 60, height: 60, borderRadius: '50%',
        border: '1px solid rgba(45,214,122,0.1)',
      }} />

      {/* Goal area top */}
      <div style={{ position: 'absolute', top: '2%', left: '30%', right: '30%', height: '12%', borderRadius: '0 0 8px 8px', border: '1px solid rgba(45,214,122,0.08)', borderTop: 'none' }} />

      {/* Goal area bottom */}
      <div style={{ position: 'absolute', bottom: '2%', left: '30%', right: '30%', height: '12%', borderRadius: '8px 8px 0 0', border: '1px solid rgba(45,214,122,0.08)', borderBottom: 'none' }} />

      {/* Position markers */}
      {POSITIONS.map(pos => {
        const playerId = assignments[pos.key];
        const player = playerId ? playerMap[playerId] : null;
        const filled = !!player;
        const initials = player
          ? player.player_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
          : '+';

        return (
          <button
            key={pos.key}
            onClick={() => onPositionTap(pos.key)}
            style={{
              position: 'absolute',
              top: `${pos.top}%`,
              left: `${pos.left}%`,
              transform: 'translate(-50%, -50%)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            }}
          >
            <div style={{
              width: 38, height: 38, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: filled ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.03)',
              border: filled ? '2px solid var(--blue)' : '1.5px dashed rgba(255,255,255,0.15)',
              color: filled ? 'var(--blue)' : 'var(--muted)',
              fontSize: filled ? 11 : 16,
              fontWeight: 800,
              fontFamily: "'Cabinet Grotesk', sans-serif",
              transition: 'all 0.2s',
            }}>
              {initials}
            </div>
            <div style={{
              fontSize: 8, fontWeight: 600, letterSpacing: '0.5px',
              color: filled ? 'var(--blue)' : 'var(--muted)',
              whiteSpace: 'nowrap',
              fontFamily: "'Cabinet Grotesk', sans-serif",
            }}>
              {filled ? (player?.player_name.split(' ').pop() || '') : pos.label}
            </div>
          </button>
        );
      })}
    </div>
  );
}

export { POSITIONS as FOOTBALL_POSITIONS };
