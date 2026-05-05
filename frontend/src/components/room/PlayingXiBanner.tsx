import { useState } from 'react';
import { usePlayingXi } from '../../hooks/usePlayingXi';
import { useIsMobile } from '../../hooks/useIsMobile';

interface PlayingXiBannerProps {
  /** Called when user taps "Edit team". Parent opens TeamBuilderModal. */
  onReviewTeam: () => void;
  /** Room status — used to keep the banner sticky pre-match. */
  roomStatus?: string;
}

/**
 * Sticky single-row banner shown only between XI announcement and kickoff.
 * Tap (mobile) or "Details" (desktop) opens a sheet with the bench list +
 * Review/Keep buttons. Closing the sheet hides the modal, NOT the banner —
 * the banner is sticky until the match locks (room.status flips off 'open'),
 * at which point it disappears entirely.
 */
export function PlayingXiBanner({ onReviewTeam, roomStatus }: PlayingXiBannerProps) {
  const { benchedSelected, xi, isInXi } = usePlayingXi();
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [view, setView] = useState<'benched' | 'full'>('benched');

  if (!xi || roomStatus !== 'open') return null;

  const benchCount = benchedSelected.length;
  const hasBenched = benchCount > 0;
  // If no one's benched, default the sheet to the Full XI view directly.
  const activeView: 'benched' | 'full' = hasBenched ? view : 'full';
  const summary = hasBenched
    ? `${benchCount} of your players ${benchCount === 1 ? "isn't" : "aren't"} in the XI`
    : 'All your picks are in the XI';

  function handleReview() {
    setSheetOpen(false);
    onReviewTeam();
  }

  function handleKeep() {
    setSheetOpen(false);
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
                  ? `${benchCount} of your selected players ${benchCount === 1 ? 'is' : 'are'} not in the announced XI. Edit your team to swap them out before the match starts — you can edit as many times as you want until kickoff.`
                  : 'Great news — every player you picked is in the announced XI. You can still tweak your XI any time before the match starts.'}
              </div>
            </div>

            {/* Toggle: Your benched | Full XI */}
            {hasBenched && xi && (
              <div className="flex gap-1 px-5 pt-3" style={{ flexShrink: 0 }}>
                {([
                  { key: 'benched' as const, label: `Your bench (${benchCount})`, accent: 'var(--red)' },
                  { key: 'full' as const, label: `Confirmed XI (${(xi.xi_a?.length || 0) + (xi.xi_b?.length || 0)})`, accent: 'var(--green)' },
                ]).map(t => {
                  const active = activeView === t.key;
                  return (
                    <button
                      key={t.key}
                      onClick={() => setView(t.key)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 8,
                        background: active ? 'var(--surface2)' : 'transparent',
                        color: active ? t.accent : 'var(--muted)',
                        border: active ? `1px solid ${t.accent}` : '1px solid var(--border)',
                        fontSize: 11,
                        fontWeight: 700,
                        fontFamily: "'Cabinet Grotesk', sans-serif",
                        letterSpacing: '0.3px',
                        cursor: 'pointer',
                      }}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Bench list */}
            {hasBenched && activeView === 'benched' && (
              <div className="flex-1 overflow-y-auto px-5 py-2">
                <div
                  className="text-[10px] uppercase tracking-[1.5px] mb-2 mt-1"
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

            {/* Full XI view — both teams' announced 11s */}
            {activeView === 'full' && xi && (
              <div className="flex-1 overflow-y-auto px-5 py-3">
                <div className="grid gap-4" style={{ gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr' }}>
                  {([
                    { name: xi.team_a, players: xi.xi_a || [] },
                    { name: xi.team_b, players: xi.xi_b || [] },
                  ]).map(team => (
                    <div key={team.name} className="rounded-lg" style={{ border: '1px solid var(--border)', background: 'var(--surface2)' }}>
                      <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--border)', fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 12, fontWeight: 800, color: 'var(--text)' }}>
                        {team.name}
                        <span className="ml-2 text-[10px]" style={{ color: 'var(--muted)', fontWeight: 600 }}>{team.players.length} starting</span>
                      </div>
                      <div className="px-3 py-2">
                        {team.players.map((player, i) => {
                          const picked = isInXi(player); // always true for Full XI; we instead check if user selected this player
                          // Mark with check if THIS specific player is in the user's selected squad
                          // (read from the room/game store via benchedSelected? Cleanest: just rely on visual list).
                          void picked;
                          return (
                            <div key={`${player}-${i}`} className="flex items-center gap-2 py-1.5" style={{ borderBottom: i < team.players.length - 1 ? '1px solid var(--border)' : 'none' }}>
                              <span style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 11, color: 'var(--muted)', width: 18, fontWeight: 700, textAlign: 'right' }}>{i + 1}</span>
                              <span className="text-[12px] truncate" style={{ color: 'var(--text)', fontWeight: 500 }}>{player}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                {!hasBenched && (
                  <div className="text-[11px] mt-3 text-center" style={{ color: 'var(--green)' }}>
                    All your selected picks are in the XI. No changes needed.
                  </div>
                )}
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
                Close
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
                Edit team
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
