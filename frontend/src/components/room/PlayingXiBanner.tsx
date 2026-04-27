import { useState } from 'react';
import { usePlayingXi } from '../../hooks/usePlayingXi';
import { useIsMobile } from '../../hooks/useIsMobile';

interface PlayingXiBannerProps {
  /** Called when user taps "Review team". Parent opens TeamBuilderModal. */
  onReviewTeam: () => void;
}

/**
 * Sticky single-row banner shown once the official playing XI drops.
 * Tap (mobile) or "Details" (desktop) opens a sheet with the bench list +
 * Review/Keep buttons. Sticky until the user makes an active choice.
 */
export function PlayingXiBanner({ onReviewTeam }: PlayingXiBannerProps) {
  const { bannerVisible, benchedSelected, dismiss } = usePlayingXi();
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);

  if (!bannerVisible) return null;

  const benchCount = benchedSelected.length;
  const hasBenched = benchCount > 0;
  const summary = hasBenched
    ? `${benchCount} of your players ${benchCount === 1 ? "isn't" : "aren't"} in the XI`
    : 'All your picks are in the XI';

  function handleReview() {
    setSheetOpen(false);
    onReviewTeam();
    // Don't auto-dismiss — opening the editor is the implicit dismiss path.
    dismiss();
  }

  function handleKeep() {
    setSheetOpen(false);
    dismiss();
  }

  return (
    <>
      {/* Sticky row */}
      <button
        onClick={() => setSheetOpen(true)}
        className="w-full flex items-center gap-2 cursor-pointer text-left"
        style={{
          background: hasBenched
            ? 'linear-gradient(90deg, rgba(240,90,90,0.10), rgba(244,185,64,0.06))'
            : 'rgba(45,214,122,0.06)',
          borderBottom: '1px solid var(--border)',
          borderTop: 'none',
          padding: isMobile ? '8px 12px' : '10px 16px',
          color: 'var(--text)',
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        <span style={{ fontSize: isMobile ? 14 : 16, lineHeight: 1 }}>🚨</span>
        <div className="flex-1 min-w-0">
          <div
            className="truncate"
            style={{
              fontSize: isMobile ? 12 : 13,
              fontWeight: 700,
              color: 'var(--text)',
            }}
          >
            Playing XI announced
          </div>
          {!isMobile && (
            <div
              className="truncate"
              style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}
            >
              {summary}
            </div>
          )}
        </div>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: hasBenched ? 'var(--red)' : 'var(--green)',
            background: hasBenched ? 'rgba(240,90,90,0.12)' : 'rgba(45,214,122,0.12)',
            padding: '3px 8px',
            borderRadius: 6,
            flexShrink: 0,
          }}
        >
          {hasBenched ? `${benchCount} OUT` : 'ALL IN'}
        </span>
        <span
          style={{
            fontSize: 14,
            color: 'var(--muted)',
            flexShrink: 0,
            marginLeft: 2,
          }}
        >
          ›
        </span>
      </button>

      {/* Bottom sheet (mobile) / centered modal (desktop) */}
      {sheetOpen && (
        <div
          className="fixed inset-0 z-[900] flex"
          style={{
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            alignItems: isMobile ? 'flex-end' : 'center',
            justifyContent: 'center',
          }}
          onClick={() => setSheetOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: isMobile ? '16px 16px 0 0' : 16,
              width: isMobile ? '100%' : 420,
              maxWidth: '100%',
              maxHeight: isMobile ? '70vh' : '80vh',
              display: 'flex',
              flexDirection: 'column',
              padding: 0,
            }}
          >
            {/* Drag handle on mobile */}
            {isMobile && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 4px' }}>
                <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)' }} />
              </div>
            )}

            <div className="px-5 pt-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <div
                style={{
                  fontFamily: "'Cabinet Grotesk', sans-serif",
                  fontSize: 18,
                  fontWeight: 900,
                  marginBottom: 4,
                }}
              >
                🚨 Playing XI announced
              </div>
              <div className="text-[12px]" style={{ color: 'var(--muted)', lineHeight: 1.5 }}>
                {hasBenched
                  ? `${benchCount} of your selected players ${benchCount === 1 ? 'is' : 'are'} not in the announced XI. Review your team to swap them out before the match starts.`
                  : 'Great news — every player you picked is in the announced XI. No changes needed.'}
              </div>
            </div>

            {/* Bench list */}
            {hasBenched && (
              <div className="flex-1 overflow-y-auto px-5 py-2">
                <div
                  className="text-[10px] uppercase tracking-[1.5px] mb-2"
                  style={{ color: 'var(--muted)', fontWeight: 700 }}
                >
                  Not in XI
                </div>
                {benchedSelected.map((p) => (
                  <div
                    key={p.player_id}
                    className="flex items-center gap-2 py-2"
                    style={{ borderBottom: '1px solid var(--border)' }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: 'var(--red)',
                        flexShrink: 0,
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold truncate">{p.player_name}</div>
                      <div className="text-[10px]" style={{ color: 'var(--muted)' }}>
                        {p.team} · {p.player_role || 'Player'}
                      </div>
                    </div>
                    <span
                      style={{
                        fontFamily: "'Cabinet Grotesk', sans-serif",
                        fontSize: 13,
                        fontWeight: 800,
                        color: 'var(--amber)',
                      }}
                    >
                      {p.weightage}x
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div
              className="flex gap-2 px-5 py-3"
              style={{ borderTop: '1px solid var(--border)', flexShrink: 0 }}
            >
              <button
                onClick={handleKeep}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: 'var(--surface2)',
                  color: 'var(--muted)',
                  border: '1px solid var(--border)',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                Keep as-is
              </button>
              <button
                onClick={handleReview}
                style={{
                  flex: 1.4,
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: 'var(--gold)',
                  color: '#09090F',
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: 'pointer',
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                Review team
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
