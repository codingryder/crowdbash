import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useCoinBalance, useRewards, redeemReward, claimDailyCheckin, type Reward } from '../hooks/useCoins';

export function RewardsPage() {
  const { user, openAuthModal } = useAuth();
  const { balance, coins, refresh: refreshBalance } = useCoinBalance();
  const { rewards, loading, error, refresh: refreshRewards } = useRewards();
  const [confirming, setConfirming] = useState<Reward | null>(null);
  const [redeeming, setRedeeming] = useState(false);
  const [claimingDaily, setClaimingDaily] = useState(false);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  function showToast(kind: 'ok' | 'err', msg: string) {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 4000);
  }

  async function handleDailyClaim() {
    if (!user || claimingDaily || coins?.daily.claimed_today) return;
    setClaimingDaily(true);
    try {
      const r = await claimDailyCheckin();
      showToast('ok', `+${r.awarded} Bashpoints claimed! Streak: ${r.current_streak} day${r.current_streak !== 1 ? 's' : ''}.`);
      await refreshBalance();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      showToast('err', err?.response?.data?.detail || 'Daily claim failed');
    } finally {
      setClaimingDaily(false);
    }
  }

  async function handleConfirm() {
    if (!confirming) return;
    setRedeeming(true);
    try {
      const r = await redeemReward(confirming.id);
      const codeMsg = r.code ? `Code: ${r.code}` : 'Pending fulfillment — we\'ll email your code shortly.';
      showToast('ok', `Redeemed ${confirming.title}. ${codeMsg}`);
      setConfirming(null);
      await Promise.all([refreshBalance(), refreshRewards()]);
    } catch (e: any) {
      showToast('err', e?.response?.data?.detail || 'Redemption failed');
    } finally {
      setRedeeming(false);
    }
  }

  return (
    <div style={{ paddingTop: 80, paddingBottom: 80, minHeight: '100vh' }}>
      <div className="max-w-[1100px] mx-auto px-5">
        {/* Header */}
        <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
          <div>
            <h1 style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 32, fontWeight: 900, letterSpacing: '-0.5px', margin: 0 }}>
              Bashpoints
            </h1>
            <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 6 }}>
              {user
                ? 'Your fan-engagement score. Earn Bashpoints by playing — climb tiers, top the leaderboard.'
                : '🆓 Free-to-play, skill-based fan-engagement. Sign in to view your Bashpoints.'}
            </p>
          </div>
          {user && (
            <div
              className="flex items-center gap-2 rounded-full"
              style={{
                padding: '10px 16px',
                background: 'rgba(245,196,49,0.12)',
                border: '1px solid rgba(245,196,49,0.3)',
              }}
            >
              <span style={{ fontSize: 18 }}>🪙</span>
              <span style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 800, fontSize: 18, color: '#f5c431' }}>
                {balance ?? 0}
              </span>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>Bashpoints</span>
            </div>
          )}
        </div>

        {!user && (
          <div className="rounded-xl text-center py-10 px-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <p style={{ color: 'var(--muted)', marginBottom: 16 }}>Sign in to view your Bashpoints, climb the leaderboard, and unlock fan perks.</p>
            <button onClick={openAuthModal} className="btn btn-primary" style={{ padding: '10px 24px' }}>
              Sign in
            </button>
          </div>
        )}

        {/* ── Tier + Daily check-in (signed-in only) ── */}
        {user && coins && (
          <div className="grid gap-4 mb-8" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
            {/* Tier card */}
            <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="text-[10px] uppercase tracking-[1.5px] mb-2" style={{ color: 'var(--muted)' }}>Your Tier</div>
              <div className="flex items-baseline gap-2">
                <span style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 28, fontWeight: 900, color: tierColor(coins.tier.name) }}>
                  {tierEmoji(coins.tier.name)} {coins.tier.name}
                </span>
                <span className="text-[13px] font-bold" style={{ color: 'var(--green)' }}>{coins.tier.multiplier}× multiplier</span>
              </div>
              <div className="text-[11px] mt-1" style={{ color: 'var(--muted)' }}>Multiplier applies to top-3 + daily payouts.</div>
              {coins.tier.next ? (
                <>
                  <div className="mt-4 mb-1.5 flex items-center justify-between text-[11px]">
                    <span style={{ color: 'var(--muted)' }}>To {coins.tier.next.name} ({coins.tier.next.multiplier}×)</span>
                    <span style={{ color: 'var(--text)', fontWeight: 700 }}>{coins.tier.next.remaining} Bashpoints to go</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.max(2, Math.min(100, ((coins.tier.lifetime_earned - coins.tier.threshold) / (coins.tier.next.threshold - coins.tier.threshold)) * 100))}%`,
                      background: 'var(--green)',
                    }} />
                  </div>
                </>
              ) : (
                <div className="text-[12px] mt-3" style={{ color: 'var(--green)' }}>Top tier — max multiplier active 🏆</div>
              )}
            </div>

            {/* Daily check-in card */}
            <div className="rounded-xl p-5 flex flex-col" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="text-[10px] uppercase tracking-[1.5px] mb-2" style={{ color: 'var(--muted)' }}>Daily Check-in</div>
              <div className="flex items-baseline gap-2 mb-1">
                <span style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 28, fontWeight: 900, color: '#f5c431' }}>
                  +{coins.daily.next_amount}
                </span>
                <span className="text-[12px]" style={{ color: 'var(--muted)' }}>Bashpoints today</span>
                {coins.tier.multiplier > 1 && (
                  <span className="text-[10px] px-1.5 py-px rounded-full" style={{ background: 'rgba(45,214,122,0.12)', color: 'var(--green)', fontWeight: 700 }}>
                    {coins.daily.base} × {coins.tier.multiplier}
                  </span>
                )}
              </div>
              {coins.daily.current_streak > 0 && (
                <div className="text-[11px] mb-3" style={{ color: 'var(--muted)' }}>
                  🔥 {coins.daily.current_streak}-day streak
                </div>
              )}
              <button
                onClick={handleDailyClaim}
                disabled={coins.daily.claimed_today || claimingDaily}
                className="btn btn-primary mt-auto"
                style={{
                  padding: '10px 16px',
                  fontSize: 13,
                  opacity: coins.daily.claimed_today ? 0.5 : 1,
                  cursor: coins.daily.claimed_today ? 'not-allowed' : 'pointer',
                }}
              >
                {claimingDaily ? 'Claiming…' : coins.daily.claimed_today ? '✓ Claimed today — back tomorrow' : `Claim ${coins.daily.next_amount} Bashpoints`}
              </button>
            </div>
          </div>
        )}

        {/* ── How to earn (always shown) ── */}
        <div className="rounded-xl p-5 mb-8" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="text-[10px] uppercase tracking-[1.5px] mb-3" style={{ color: 'var(--muted)' }}>How to earn Bashpoints</div>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <EarnRule icon="🎁" title={`+${coins?.rules.signup_bonus ?? 50} signup bonus`} desc="One-time, when you verify your email." />
            <EarnRule icon="🗓️" title={`+${coins?.rules.daily_base ?? 10} daily check-in`} desc="One claim per day. Multiplied by your tier." />
            <EarnRule icon="🥇" title="+100 / +50 / +25 top-3 finish" desc="Earned per match for placing 1st / 2nd / 3rd." />
            <EarnRule icon="⚡" title="Tier multipliers" desc="Bronze 1× · Silver 1.25× · Gold 1.5× · Platinum 2×" />
          </div>
        </div>

        {/* Voucher catalog — gated to signed-in users only. The catalog
            is the only place vouchers are mentioned publicly; logged-out
            visitors don't see SKUs or any "redeem for ₹" framing. */}
        {user && (
          <>
            <div className="text-[10px] uppercase tracking-[1.5px] mb-3" style={{ color: 'var(--muted)' }}>Fan perks · redeem your Bashpoints</div>
            {loading && <p style={{ color: 'var(--muted)' }}>Loading…</p>}
            {error && <p style={{ color: '#ef4444' }}>{error}</p>}

            {!loading && !error && rewards.length === 0 && (
              <div className="rounded-xl text-center py-10 px-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <p style={{ color: 'var(--muted)' }}>No fan perks available yet. Check back soon.</p>
              </div>
            )}
          </>
        )}

        {/* Grid (signed-in only) */}
        {user && (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
          {rewards.map((r) => {
            const canAfford = user && balance !== null && balance >= r.coin_cost;
            const outOfStock = r.stock !== null && r.stock <= 0;
            return (
              <div
                key={r.id}
                className="rounded-xl p-5 flex flex-col"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              >
                <div className="flex-1">
                  <h3 style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 17, fontWeight: 800, margin: 0 }}>{r.title}</h3>
                  {r.description && (
                    <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>{r.description}</p>
                  )}
                </div>
                <div className="flex items-center justify-between mt-5 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
                  <div className="flex items-center gap-1.5" style={{ color: '#f5c431', fontWeight: 800, fontFamily: "'Cabinet Grotesk', sans-serif" }}>
                    🪙 <span style={{ fontSize: 16 }}>{r.coin_cost}</span>
                  </div>
                  <button
                    onClick={() => user ? setConfirming(r) : openAuthModal()}
                    disabled={user ? (!canAfford || outOfStock) : false}
                    className="btn btn-primary"
                    style={{
                      padding: '6px 14px',
                      fontSize: 12,
                      opacity: user && (!canAfford || outOfStock) ? 0.4 : 1,
                      cursor: user && (!canAfford || outOfStock) ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {outOfStock ? 'Out of stock' : !user ? 'Sign in' : !canAfford ? 'Not enough' : 'Redeem'}
                  </button>
                </div>
                {r.stock !== null && !outOfStock && (
                  <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 8 }}>{r.stock} left</div>
                )}
              </div>
            );
          })}
        </div>
        )}
      </div>

      {/* Confirm modal */}
      {confirming && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={() => !redeeming && setConfirming(null)}
        >
          <div
            className="rounded-xl p-6 max-w-md w-full"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 20, fontWeight: 800, margin: 0 }}>
              Redeem {confirming.title}?
            </h3>
            <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 12 }}>
              This will deduct <span style={{ color: '#f5c431', fontWeight: 700 }}>🪙 {confirming.coin_cost}</span> from your balance. This action can't be undone.
            </p>
            <div className="flex gap-3 mt-6 justify-end">
              <button
                onClick={() => setConfirming(null)}
                disabled={redeeming}
                className="btn"
                style={{ padding: '8px 18px', fontSize: 13, background: 'transparent', color: 'var(--muted)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={redeeming}
                className="btn btn-primary"
                style={{ padding: '8px 18px', fontSize: 13 }}
              >
                {redeeming ? 'Redeeming…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 z-[1100] rounded-lg px-4 py-3 max-w-md"
          style={{
            transform: 'translateX(-50%)',
            background: toast.kind === 'ok' ? 'rgba(45,214,122,0.15)' : 'rgba(239,68,68,0.15)',
            border: `1px solid ${toast.kind === 'ok' ? 'rgba(45,214,122,0.4)' : 'rgba(239,68,68,0.4)'}`,
            color: toast.kind === 'ok' ? 'var(--green)' : '#ef4444',
            fontSize: 13,
          }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function EarnRule({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="flex gap-3">
      <div style={{ fontSize: 22, lineHeight: 1.2 }}>{icon}</div>
      <div>
        <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{title}</div>
        <div className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>{desc}</div>
      </div>
    </div>
  );
}

function tierEmoji(name: string): string {
  switch (name) {
    case 'Silver': return '🥈';
    case 'Gold': return '🥇';
    case 'Platinum': return '💎';
    default: return '🟫';
  }
}

function tierColor(name: string): string {
  switch (name) {
    case 'Silver': return '#c0c5d0';
    case 'Gold': return '#f5c431';
    case 'Platinum': return '#9ad9ff';
    default: return '#cd8f5a';
  }
}
