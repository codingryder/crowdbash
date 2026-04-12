import type { SquadPlayer } from '../../types';

interface PosCoord {
  top?: number | string;
  bottom?: number;
  left?: number | string;
  right?: number;
  tx?: string;
  label: string;
}

// Coordinates scaled for 540px field (1.184x from 456px original)
const POS_COORDS: PosCoord[] = [
  { top: 10, left: '50%', tx: '-50%', label: 'Long On' },
  { top: 42, left: 82, label: 'Fine Leg' },
  { top: 42, right: 82, label: 'Long Off' },
  { top: 155, left: 18, label: 'Mid Wicket' },
  { top: 155, right: 18, label: 'Cover' },
  { top: 188, left: 98, label: 'Mid On' },
  { top: 188, right: 98, label: 'Mid Off' },
  { top: 222, left: '50%', tx: '-50%', label: 'Bowler' },
  { bottom: 148, left: '50%', tx: '-50%', label: 'Keeper' },
  { bottom: 60, left: 98, label: 'Square Leg' },
  { bottom: 60, right: 98, label: 'Point' },
];

interface CricketPitchProps {
  slots: (SquadPlayer | null)[];
  powers: number[];
  selectedPlayer: SquadPlayer | null;
  phase: number;
  onSlotClick: (index: number) => void;
  hint: string;
  activeSlot?: number | null;
}

export function CricketPitch({ slots, powers, selectedPlayer, phase, onSlotClick, hint, activeSlot }: CricketPitchProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', flex: 1 }}>
      {/* Hint text */}
      <div style={{ position: 'absolute', top: 14, fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: 2, color: 'var(--muted)', zIndex: 5 }}>
        {hint}
      </div>

      {/* Field container — large */}
      <div style={{ position: 'relative', width: 540, height: 540, flexShrink: 0 }}>
        {/* SVG Field */}
        <svg width="540" height="540" viewBox="0 0 456 456" preserveAspectRatio="xMidYMid meet" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
          <ellipse cx="228" cy="228" rx="222" ry="222" fill="#111f11" />
          <ellipse cx="228" cy="228" rx="180" ry="180" fill="#142814" />
          <ellipse cx="228" cy="228" rx="132" ry="132" fill="#163016" stroke="rgba(255,255,255,0.04)" strokeWidth="1" strokeDasharray="5,6" />
          <ellipse cx="228" cy="228" rx="83" ry="83" fill="#183618" />
          <rect x="211" y="161" width="34" height="134" rx="3" fill="#c4a468" />
          <rect x="207" y="183" width="42" height="2" fill="#e0cc96" rx="1" />
          <rect x="207" y="271" width="42" height="2" fill="#e0cc96" rx="1" />
          {/* Stumps top */}
          <rect x="220" y="176" width="2.5" height="10" fill="rgba(255,255,255,0.8)" rx="1" />
          <rect x="226" y="176" width="2.5" height="10" fill="rgba(255,255,255,0.8)" rx="1" />
          <rect x="232" y="176" width="2.5" height="10" fill="rgba(255,255,255,0.8)" rx="1" />
          {/* Stumps bottom */}
          <rect x="220" y="269" width="2.5" height="10" fill="rgba(255,255,255,0.8)" rx="1" />
          <rect x="226" y="269" width="2.5" height="10" fill="rgba(255,255,255,0.8)" rx="1" />
          <rect x="232" y="269" width="2.5" height="10" fill="rgba(255,255,255,0.8)" rx="1" />
          {/* Directional labels */}
          <text x="228" y="21" textAnchor="middle" fill="rgba(255,255,255,0.07)" fontSize="8" fontFamily="Cabinet Grotesk,sans-serif" fontWeight="700" letterSpacing="2">STRAIGHT</text>
          <text x="228" y="447" textAnchor="middle" fill="rgba(255,255,255,0.07)" fontSize="8" fontFamily="Cabinet Grotesk,sans-serif" fontWeight="700" letterSpacing="2">FINE LEG</text>
          <text x="11" y="232" textAnchor="middle" fill="rgba(255,255,255,0.07)" fontSize="8" fontFamily="Cabinet Grotesk,sans-serif" fontWeight="700" letterSpacing="2" transform="rotate(-90,11,232)">SQUARE LEG</text>
          <text x="445" y="232" textAnchor="middle" fill="rgba(255,255,255,0.07)" fontSize="8" fontFamily="Cabinet Grotesk,sans-serif" fontWeight="700" letterSpacing="2" transform="rotate(90,445,232)">COVER</text>
        </svg>

        {/* Slots */}
        {POS_COORDS.map((pos, i) => {
          const player = slots[i];
          const hasSel = !!selectedPlayer && phase === 1;
          const filled = !!player;

          const style: React.CSSProperties = {
            position: 'absolute', width: 64, height: 64, borderRadius: '50%',
            border: (filled && activeSlot === i) ? '2px solid var(--amber)' : filled ? '1.5px solid rgba(255,255,255,0.1)' : '1.5px dashed rgba(255,255,255,0.11)',
            borderStyle: filled ? 'solid' : 'dashed',
            boxShadow: (activeSlot === i) ? '0 0 12px rgba(245,158,11,0.3)' : 'none',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: 'all 0.2s', zIndex: 10,
            background: (hasSel && !filled) ? 'rgba(45,214,122,0.08)' : 'transparent',
            borderColor: (hasSel && !filled) ? 'var(--green)' : filled ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.11)',
          };

          if (pos.top !== undefined) style.top = typeof pos.top === 'number' ? pos.top : pos.top;
          if ('bottom' in pos && pos.bottom !== undefined) style.bottom = pos.bottom;
          if (pos.left !== undefined) style.left = typeof pos.left === 'number' ? pos.left : pos.left;
          if ('right' in pos && pos.right !== undefined) style.right = pos.right;
          if ('tx' in pos) style.transform = `translateX(${pos.tx})`;

          const roleColor = player ? getRoleColor(player.player_role) : { bg: '', color: '' };
          const initials = player ? player.player_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '';
          const lastName = player ? player.player_name.split(' ').pop() || '' : '';

          return (
            <div key={i} style={style} onClick={() => onSlotClick(i)} title={filled ? 'Click to remove' : pos.label}>
              {filled ? (
                <>
                  <div style={{
                    width: 34, height: 34, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 10, fontWeight: 700,
                    background: roleColor.bg, color: roleColor.color,
                    position: 'relative',
                  }}>
                    {initials}
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
                <div style={{ fontSize: 8, color: 'var(--faint)', fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 700, letterSpacing: 0.5, textAlign: 'center', lineHeight: 1.3 }}>
                  {pos.label.toUpperCase()}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getRoleColor(role: string): { bg: string; color: string } {
  const r = role.toLowerCase();
  if (r.includes('bat') || r === 'batsman') return { bg: 'rgba(45,214,122,0.15)', color: '#2dd67a' };
  if (r.includes('bowl') || r === 'bowler') return { bg: 'rgba(139,92,246,0.12)', color: '#8b5cf6' };
  if (r.includes('all') || r === 'all-rounder') return { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' };
  if (r.includes('keep') || r.includes('wk') || r === 'wicket-keeper') return { bg: 'rgba(192,194,200,0.08)', color: 'rgba(192,194,200,0.8)' };
  return { bg: 'rgba(45,214,122,0.1)', color: '#2dd67a' };
}

export { POS_COORDS };
