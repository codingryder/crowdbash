import { useState } from 'react';

const AV_COLORS = [
  { bg: 'rgba(45,214,122,0.15)', color: '#2dd67a' },
  { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
  { bg: 'rgba(139,92,246,0.15)', color: '#8b5cf6' },
  { bg: 'rgba(59,130,246,0.15)', color: '#3b82f6' },
  { bg: 'rgba(240,82,82,0.15)', color: '#f05252' },
];

function initialsFor(name: string): string {
  return (name || '?')
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

interface Props {
  name: string;
  imageUrl?: string | null;
  /** pixel size of the avatar (square) */
  size?: number;
  /** corner radius in px; default 50% (circle) for the photo, slight rounding for fallback */
  radius?: number;
  /** color seed override (defaults to using `name`) */
  seed?: string;
  className?: string;
  /** font size override for the initials text */
  fontSize?: number;
}

export function PlayerAvatar({
  name,
  imageUrl,
  size = 30,
  radius,
  seed,
  className = '',
  fontSize,
}: Props) {
  const [imgError, setImgError] = useState(false);
  const seedStr = seed || name || '?';
  const av = AV_COLORS[seedStr.charCodeAt(0) % AV_COLORS.length];
  const r = radius ?? Math.round(size * 0.23);

  const showImage = !!imageUrl && !imgError;

  if (showImage) {
    return (
      <div
        className={`shrink-0 overflow-hidden ${className}`}
        style={{ width: size, height: size, borderRadius: r, background: av.bg }}
      >
        <img
          src={imageUrl!}
          alt={name}
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={() => setImgError(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </div>
    );
  }

  const fs = fontSize ?? Math.max(8, Math.round(size * 0.32));
  return (
    <div
      className={`shrink-0 flex items-center justify-center font-bold ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: r,
        background: av.bg,
        color: av.color,
        fontSize: fs,
        fontFamily: "'Cabinet Grotesk', sans-serif",
      }}
    >
      {initialsFor(name)}
    </div>
  );
}
