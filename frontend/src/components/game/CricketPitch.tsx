import type { SquadPlayer } from '../../types';

const POSITIONS = [
  { key: 'wk', label: 'Keeper', top: 74, left: 50, role: 'wicket-keeper' },
  { key: 'slip', label: 'Slip', top: 68, left: 64, role: '' },
  { key: 'gully', label: 'Gully', top: 58, left: 76, role: '' },
  { key: 'point', label: 'Point', top: 46, left: 84, role: '' },
  { key: 'cover', label: 'Cover', top: 34, left: 76, role: '' },
  { key: 'mid_off', label: 'Mid Off', top: 24, left: 62, role: '' },
  { key: 'mid_on', label: 'Mid On', top: 24, left: 38, role: '' },
  { key: 'sq_leg', label: 'Sq Leg', top: 46, left: 16, role: '' },
  { key: 'fine_leg', label: 'Fine Leg', top: 66, left: 24, role: '' },
  { key: 'deep_mw', label: 'Deep MW', top: 16, left: 26, role: '' },
  { key: 'long_off', label: 'Long Off', top: 10, left: 54, role: '' },
];

interface CricketPitchProps {
  assignments: Record<string, string>; // positionKey -> playerId
  allPlayers: SquadPlayer[];
  onPositionTap: (positionKey: string) => void;
}

export function CricketPitch({ assignments, allPlayers, onPositionTap }: CricketPitchProps) {
  const playerMap = Object.fromEntries(allPlayers.map(p => [p.player_id, p]));

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 400, aspectRatio: '1 / 1.15', margin: '0 auto' }}>
      {/* Oval field */}
      <div style={{
        position: 'absolute', inset: 0,
        borderRadius: '50%',
        background: 'radial-gradient(ellipse at center, rgba(45,214,122,0.07) 0%, rgba(45,214,122,0.02) 50%, transparent 75%)',
        border: '1.5px solid rgba(45,214,122,0.12)',
      }} />

      {/* Center pitch strip */}
      <div style={{
        position: 'absolute', top: '38%', left: '50%', transform: 'translateX(-50%)',
        width: 28, height: '24%', borderRadius: 4,
        background: 'rgba(245,158,11,0.06)',
        border: '1px solid rgba(245,158,11,0.15)',
      }} />

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
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            {/* Circle */}
            <div style={{
              width: 38, height: 38,
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: filled ? 'rgba(45,214,122,0.15)' : 'rgba(255,255,255,0.03)',
              border: filled ? '2px solid var(--green)' : '1.5px dashed rgba(255,255,255,0.15)',
              color: filled ? 'var(--green)' : 'var(--muted)',
              fontSize: filled ? 11 : 16,
              fontWeight: 800,
              fontFamily: "'Cabinet Grotesk', sans-serif",
              transition: 'all 0.2s',
            }}>
              {initials}
            </div>
            {/* Label */}
            <div style={{
              fontSize: 8, fontWeight: 600, letterSpacing: '0.5px',
              color: filled ? 'var(--green)' : 'var(--muted)',
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

export { POSITIONS as CRICKET_POSITIONS };
