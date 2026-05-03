interface XiStatusBadgeProps {
  inXi: boolean;
  size?: 'xs' | 'sm';
}

/**
 * Small visible marker shown next to a player's name once the official
 * Playing XI has dropped. Green "PLAYING" if the player is in today's
 * announced XI, red "OUT" if they're benched / not in the matchday squad.
 *
 * Render only when `usePlayingXi().announced` is true — otherwise the
 * status is unknown and showing either label would be misleading.
 */
export function XiStatusBadge({ inXi, size = 'xs' }: XiStatusBadgeProps) {
  const fontSize = size === 'sm' ? 10 : 9;
  const padX = size === 'sm' ? 7 : 5;
  const padY = size === 'sm' ? 2 : 1;
  return (
    <span
      title={inXi ? 'In announced playing XI today' : 'Not in announced playing XI today'}
      className="font-cabinet font-bold rounded shrink-0"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        fontSize,
        lineHeight: 1,
        padding: `${padY}px ${padX}px`,
        color: inXi ? 'var(--green)' : 'var(--red)',
        background: inXi ? 'rgba(45,214,122,0.14)' : 'rgba(240,82,82,0.12)',
        border: inXi ? '1px solid rgba(45,214,122,0.35)' : '1px solid rgba(240,82,82,0.35)',
        letterSpacing: '0.4px',
      }}
    >
      <span
        style={{
          display: 'inline-block',
          width: 5,
          height: 5,
          borderRadius: '50%',
          background: inXi ? 'var(--green)' : 'var(--red)',
        }}
      />
      {inXi ? 'PLAYING' : 'OUT'}
    </span>
  );
}
