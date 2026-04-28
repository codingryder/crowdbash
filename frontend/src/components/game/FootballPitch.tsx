import type { SquadPlayer } from '../../types';
import { PlayerAvatar } from '../ui/PlayerAvatar';
import { usePlayingXi } from '../../hooks/usePlayingXi';

interface PosCoord {
  top?: number | string;
  bottom?: number | string;
  left?: number | string;
  right?: number | string;
  tx?: string;
  /** Short canonical role label shown when the slot is empty. */
  label: string;
  /** Position abbreviation (e.g. "LW", "CB", "CM") for the slot tooltip + sub-label. */
  position: string;
}

// Default 4-3-3 layout. Slot index order matters (used by handleSlotClick) —
// we keep it FW (top of screen) → MID → DEF → GK so the array reads top-down.
const POS_COORDS: PosCoord[] = [
  // Forward line
  { top: '8%', left: '20%', label: 'FW', position: 'LW' },
  { top: '6%', left: '50%', tx: '-50%', label: 'FW', position: 'ST' },
  { top: '8%', right: '20%', label: 'FW', position: 'RW' },
  // Midfield
  { top: '34%', left: '22%', label: 'MID', position: 'LM' },
  { top: '32%', left: '50%', tx: '-50%', label: 'MID', position: 'CM' },
  { top: '34%', right: '22%', label: 'MID', position: 'RM' },
  // Defence
  { top: '60%', left: '12%', label: 'DEF', position: 'LB' },
  { top: '62%', left: '36%', label: 'DEF', position: 'CB' },
  { top: '62%', right: '36%', label: 'DEF', position: 'CB' },
  { top: '60%', right: '12%', label: 'DEF', position: 'RB' },
  // Goalkeeper
  { bottom: '6%', left: '50%', tx: '-50%', label: 'GK', position: 'GK' },
];

interface FootballPitchProps {
  slots: (SquadPlayer | null)[];
  powers: number[];
  selectedPlayer: SquadPlayer | null;
  phase: number;
  onSlotClick: (index: number) => void;
  hint: string;
  activeSlot?: number | null;
}

export function FootballPitch({ slots, powers, selectedPlayer, phase, onSlotClick, hint, activeSlot }: FootballPitchProps) {
  const { announced: xiAnnounced, isInXi } = usePlayingXi();
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', flex: 1 }}>
      {/* Hint text */}
      <div style={{ position: 'absolute', top: 14, fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: 2, color: 'var(--muted)', zIndex: 5 }}>
        {hint}
      </div>

      {/* Field container — slightly portrait so the football pitch reads
          correctly without overflowing on mobile. */}
      <div style={{ position: 'relative', width: '100%', maxWidth: 460, aspectRatio: '5 / 7', flexShrink: 0 }}>
        {/* SVG field. viewBox is 500x700 so each marking is sized in
            pitch-units rather than container pixels. */}
        <svg
          viewBox="0 0 500 700"
          preserveAspectRatio="xMidYMid meet"
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        >
          {/* Turf base */}
          <rect x="0" y="0" width="500" height="700" fill="#0f1f10" />
          {/* Subtle vertical mowing stripes for texture */}
          {Array.from({ length: 7 }).map((_, i) => (
            <rect
              key={i}
              x={i * 71}
              y="0"
              width="71"
              height="700"
              fill={i % 2 === 0 ? '#122412' : '#0f1f10'}
              opacity="0.55"
            />
          ))}
          {/* Outer pitch boundary */}
          <rect x="20" y="20" width="460" height="660" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="2" />
          {/* Halfway line */}
          <line x1="20" y1="350" x2="480" y2="350" stroke="rgba(255,255,255,0.18)" strokeWidth="2" />
          {/* Centre circle */}
          <circle cx="250" cy="350" r="60" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="2" />
          <circle cx="250" cy="350" r="3" fill="rgba(255,255,255,0.18)" />

          {/* Top penalty area (opponent's end) */}
          <rect x="120" y="20" width="260" height="100" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="2" />
          <rect x="180" y="20" width="140" height="40" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="2" />
          <rect x="220" y="10" width="60" height="10" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="2" />
          <path d="M 200 120 A 60 60 0 0 0 300 120" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="2" />

          {/* Bottom penalty area (own end) */}
          <rect x="120" y="580" width="260" height="100" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="2" />
          <rect x="180" y="640" width="140" height="40" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="2" />
          <rect x="220" y="680" width="60" height="10" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="2" />
          <path d="M 200 580 A 60 60 0 0 1 300 580" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="2" />

          {/* Directional labels — faint, mirrors CricketPitch's STRAIGHT/COVER text */}
          <text x="250" y="60" textAnchor="middle" fill="rgba(255,255,255,0.07)" fontSize="11" fontFamily="Cabinet Grotesk,sans-serif" fontWeight="700" letterSpacing="3">ATTACK</text>
          <text x="250" y="660" textAnchor="middle" fill="rgba(255,255,255,0.07)" fontSize="11" fontFamily="Cabinet Grotesk,sans-serif" fontWeight="700" letterSpacing="3">DEFENCE</text>
        </svg>

        {/* Slots */}
        {POS_COORDS.map((pos, i) => {
          const player = slots[i];
          const hasSel = !!selectedPlayer && phase === 1;
          const filled = !!player;
          const isBenched = filled && xiAnnounced && !isInXi(player!.player_name);

          const style: React.CSSProperties = {
            position: 'absolute', width: 'clamp(48px, 12vw, 64px)', height: 'clamp(48px, 12vw, 64px)', borderRadius: '50%',
            border: isBenched
              ? '2px solid var(--red)'
              : (filled && activeSlot === i)
                ? '2px solid var(--amber)'
                : filled
                  ? '1.5px solid rgba(255,255,255,0.1)'
                  : '1.5px dashed rgba(255,255,255,0.11)',
            borderStyle: filled ? 'solid' : 'dashed',
            boxShadow: isBenched
              ? '0 0 12px rgba(240,82,82,0.35)'
              : (activeSlot === i)
                ? '0 0 12px rgba(245,158,11,0.3)'
                : 'none',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: 'all 0.2s', zIndex: 10,
            background: (hasSel && !filled) ? 'rgba(45,214,122,0.08)' : 'transparent',
            borderColor: isBenched
              ? 'var(--red)'
              : (hasSel && !filled)
                ? 'var(--green)'
                : filled
                  ? 'rgba(255,255,255,0.1)'
                  : 'rgba(255,255,255,0.11)',
          };

          if (pos.top !== undefined) style.top = pos.top;
          if ('bottom' in pos && pos.bottom !== undefined) style.bottom = pos.bottom;
          if (pos.left !== undefined) style.left = pos.left;
          if ('right' in pos && pos.right !== undefined) style.right = pos.right;
          if ('tx' in pos) style.transform = `translateX(${pos.tx})`;

          const lastName = player ? player.player_name.split(' ').pop() || '' : '';

          return (
            <div key={i} style={style} onClick={() => onSlotClick(i)} title={filled ? 'Click to remove' : pos.position}>
              {filled && player ? (
                <>
                  <div style={{ position: 'relative', width: 34, height: 34 }}>
                    <PlayerAvatar
                      name={player.player_name}
                      imageUrl={player.image_url}
                      size={34}
                      radius={17}
                      fontSize={10}
                    />
                    <div style={{
                      position: 'absolute', top: -4, right: -4, width: 17, height: 17,
                      borderRadius: '50%', background: 'var(--amber)', color: '#000',
                      fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 9, fontWeight: 900,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: '1.5px solid var(--bg)',
                    }}>
                      {powers[i]}
                    </div>
                  </div>
                  <div style={{ fontSize: 9, fontWeight: 600, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: 58, color: 'var(--text)', marginTop: 2 }}>
                    {lastName}
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1.1 }}>
                  <div style={{ fontSize: 10, color: 'var(--faint)', fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 800, letterSpacing: 0.5 }}>{pos.label}</div>
                  <div style={{ fontSize: 7, marginTop: 2, color: 'rgba(255,255,255,0.18)', fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 700 }}>{pos.position}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


export { POS_COORDS };
