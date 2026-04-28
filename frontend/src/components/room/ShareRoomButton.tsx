import { useState } from 'react';

interface ShareRoomButtonProps {
  roomId: string;
  matchName: string;
  small?: boolean;
}

/**
 * Share-link button for a Crowdbash room. Uses the Web Share API where
 * available (mobile native sheet) and falls back to clipboard on
 * desktop. The URL points at `<backend>/share/room/{id}` — that route
 * returns a tiny HTML stub with per-room og:* meta tags so crawlers
 * (WhatsApp, Twitter, LinkedIn, iMessage) render a team-specific
 * preview card. Humans get redirected to /room/{id} on the SPA.
 */
export function ShareRoomButton({ roomId, matchName, small }: ShareRoomButtonProps) {
  const [toast, setToast] = useState<string | null>(null);

  const apiBase = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');
  const shareUrl = `${apiBase}/share/room/${roomId}`;

  async function handleShare() {
    // Prefer the native share sheet on mobile / supported browsers.
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: `${matchName} · Crowdbash`,
          text: `${matchName} on Crowdbash — build your fantasy XI and reshuffle live.`,
          url: shareUrl,
        });
        return;
      } catch {
        // User cancelled the share sheet — fall through to clipboard.
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setToast('Link copied to clipboard');
    } catch {
      setToast('Could not copy. URL: ' + shareUrl);
    }
    setTimeout(() => setToast(null), 2200);
  }

  return (
    <>
      <button
        onClick={handleShare}
        title="Share this room"
        aria-label="Share this room"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 7,
          padding: small ? '5px 10px' : '7px 12px',
          fontSize: small ? 10 : 12,
          fontWeight: 700,
          color: 'var(--muted)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 5,
        }}
      >
        {/* Inline share icon — Material-style */}
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
        {!small && <span>Share</span>}
      </button>

      {toast && (
        <div
          className="fixed bottom-6 left-1/2 z-[1100] rounded-lg px-4 py-2.5 max-w-md"
          style={{
            transform: 'translateX(-50%)',
            background: 'rgba(45,214,122,0.18)',
            border: '1px solid rgba(45,214,122,0.4)',
            color: 'var(--green)',
            fontSize: 13,
            fontFamily: "'Cabinet Grotesk', sans-serif",
            fontWeight: 700,
          }}
        >
          {toast}
        </div>
      )}
    </>
  );
}
