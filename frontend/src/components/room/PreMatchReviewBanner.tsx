import { useEffect, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { usePlayingXi } from '../../hooks/usePlayingXi';
import { useIsMobile } from '../../hooks/useIsMobile';

interface PreMatchReviewBannerProps {
  roomStatus?: string;
  matchDateIso?: string | null;
  onReviewTeam: () => void;
}

/**
 * Pre-match nudge that fires whenever the room is still 'open' and either
 * (a) no official XI has been published yet, or (b) the match starts soon.
 *
 * The official-XI banner (PlayingXiBanner) takes over once Gemini returns
 * an XI for the fixture — until then, this banner reminds the user that
 * they can edit their squad as many times as they want before kickoff.
 *
 * Hidden when:
 * - Room is no longer 'open' (match started or closed)
 * - The official XI has been announced (PlayingXiBanner handles it)
 * - The user has no saved game in this room
 */
export function PreMatchReviewBanner({ roomStatus, matchDateIso, onReviewTeam }: PreMatchReviewBannerProps) {
  const game = useGameStore((s) => s.game);
  const { announced } = usePlayingXi();
  const isMobile = useIsMobile();
  const [now, setNow] = useState(() => Date.now());

  // Tick once a minute so the countdown text refreshes.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  if (roomStatus !== 'open') return null;
  if (announced) return null; // PlayingXiBanner has the floor
  if (!game) return null;

  const matchMs = matchDateIso ? new Date(matchDateIso).getTime() : null;
  const minutesUntil = matchMs ? Math.max(0, Math.round((matchMs - now) / 60_000)) : null;

  let timeLabel = 'before kickoff';
  if (minutesUntil != null) {
    if (minutesUntil > 60 * 24) {
      const d = Math.round(minutesUntil / (60 * 24));
      timeLabel = `Match starts in ~${d} day${d === 1 ? '' : 's'}`;
    } else if (minutesUntil > 60) {
      const h = Math.round(minutesUntil / 60);
      timeLabel = `Match starts in ~${h}h`;
    } else if (minutesUntil > 0) {
      timeLabel = `Match starts in ~${minutesUntil} min`;
    } else {
      timeLabel = 'Match is about to start';
    }
  }

  const urgent = minutesUntil != null && minutesUntil <= 90;

  return (
    <div
      className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4 shrink-0 animate-fadeup"
      style={{
        background: urgent ? 'rgba(244,185,64,0.06)' : 'var(--surface2)',
        border: urgent ? '1px solid rgba(244,185,64,0.35)' : '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '14px 18px',
        margin: '12px 24px 0',
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-9 h-9 rounded-[9px] flex items-center justify-center text-[17px] shrink-0"
          style={{ background: urgent ? 'rgba(244,185,64,0.14)' : 'rgba(74,158,255,0.12)' }}
        >
          {urgent ? '⏰' : '📋'}
        </div>
        <div>
          <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 13, fontWeight: 800 }}>
            {urgent ? 'Review your team before kickoff' : 'Review your XI before the match'}
          </div>
          <div className="text-[11px]" style={{ color: 'var(--muted)' }}>
            {timeLabel} · You can edit your XI as many times as you want until the match starts. The announced lineup may drop late — check back so you don't get stuck with players who aren't actually playing today.
          </div>
        </div>
      </div>
      <button
        onClick={onReviewTeam}
        className="btn self-stretch md:self-auto md:shrink-0"
        style={{
          background: urgent ? 'var(--gold)' : 'var(--surface3)',
          color: urgent ? '#09090F' : 'var(--text)',
          padding: '8px 18px',
          fontSize: isMobile ? 12 : 13,
          fontWeight: 700,
        }}
      >
        Edit team ↗
      </button>
    </div>
  );
}
