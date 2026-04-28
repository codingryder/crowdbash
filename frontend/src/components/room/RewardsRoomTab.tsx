import { Link } from 'react-router-dom';
import { useCoinBalance, claimDailyCheckin } from '../../hooks/useCoins';
import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';

/**
 * Rewards info tab inside a game room. Shows the user how to earn
 * Bashpoints IN THIS ROOM (top-3 payouts adjusted for their tier
 * multiplier), the other passive earning paths (signup, daily), and
 * links to the Rewards page for redemption.
 */
export function RewardsRoomTab() {
  const { user, openAuthModal } = useAuth();
  const { coins, refresh } = useCoinBalance();
  const [claiming, setClaiming] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function handleDailyClaim() {
    if (!user || claiming || coins?.daily.claimed_today) return;
    setClaiming(true);
    try {
      const r = await claimDailyCheckin();
      setToast(`+${r.awarded} Bashpoints claimed!`);
      await refresh();
      setTimeout(() => setToast(null), 3000);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setToast(err?.response?.data?.detail || 'Daily claim failed');
      setTimeout(() => setToast(null), 3000);
    } finally {
      setClaiming(false);
    }
  }

  const multiplier = coins?.tier.multiplier ?? 1.0;
  const payout = (base: number) => Math.round(base * multiplier);

  return (
    <div style={{ padding: '20px 24px' }}>
      <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 18, fontWeight: 900, marginBottom: 4 }}>Bashpoints</div>
      <div className="text-[12px] mb-5" style={{ color: 'var(--muted)' }}>Earn Bashpoints from this match and across the platform — they're your fan-engagement score, redeemable for fan perks.</div>

      {!user && (
        <div className="rounded-xl text-center py-8 px-5 mb-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="text-[13px] mb-3" style={{ color: 'var(--muted)' }}>Sign in to see your tier and claim rewards.</div>
          <button onClick={openAuthModal} className="btn btn-primary" style={{ padding: '8px 20px', fontSize: 12 }}>Sign in</button>
        </div>
      )}

      {/* Top-3 payouts for THIS room with the user's multiplier baked in */}
      <div className="rounded-xl p-5 mb-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] uppercase tracking-[1.5px]" style={{ color: 'var(--muted)' }}>Match payouts</div>
          {coins && (
            <div className="text-[11px]" style={{ color: 'var(--muted)' }}>Your multiplier: <span style={{ color: 'var(--green)', fontWeight: 700 }}>{multiplier}×</span></div>
          )}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { rank: '🥇', label: '1st', base: 100 },
            { rank: '🥈', label: '2nd', base: 50 },
            { rank: '🥉', label: '3rd', base: 25 },
          ].map(p => (
            <div key={p.label} className="rounded-lg p-3 text-center" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 20 }}>{p.rank}</div>
              <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 18, fontWeight: 900, color: '#f5c431' }}>+{payout(p.base)}</div>
              {coins && multiplier > 1 && (
                <div className="text-[9px]" style={{ color: 'var(--muted)' }}>base {p.base} × {multiplier}</div>
              )}
              <div className="text-[10px] mt-0.5" style={{ color: 'var(--muted)' }}>{p.label} place</div>
            </div>
          ))}
        </div>
        <div className="text-[10px] mt-3" style={{ color: 'var(--faint)' }}>Awarded automatically when the match closes — only if your final points are &gt; 0.</div>
      </div>

      {/* Tier card */}
      {user && coins && (
        <div className="rounded-xl p-5 mb-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="text-[10px] uppercase tracking-[1.5px] mb-2" style={{ color: 'var(--muted)' }}>Your Tier</div>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 22, fontWeight: 900 }}>
              {coins.tier.name}
            </span>
            <span className="text-[12px] font-bold" style={{ color: 'var(--green)' }}>{multiplier}× multiplier</span>
            <span className="text-[11px]" style={{ color: 'var(--muted)' }}>· {coins.tier.lifetime_earned} lifetime Bashpoints earned</span>
          </div>
          {coins.tier.next && (
            <div className="text-[11px] mt-2" style={{ color: 'var(--muted)' }}>
              Reach <span style={{ color: 'var(--text)', fontWeight: 700 }}>{coins.tier.next.name}</span> ({coins.tier.next.multiplier}×) in {coins.tier.next.remaining} more Bashpoints.
            </div>
          )}
        </div>
      )}

      {/* Daily check-in */}
      {user && coins && (
        <div className="rounded-xl p-5 mb-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="text-[10px] uppercase tracking-[1.5px] mb-1" style={{ color: 'var(--muted)' }}>Daily check-in</div>
              <div className="flex items-baseline gap-2">
                <span style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 20, fontWeight: 900, color: '#f5c431' }}>+{coins.daily.next_amount}</span>
                <span className="text-[12px]" style={{ color: 'var(--muted)' }}>Bashpoints today</span>
                {coins.daily.current_streak > 0 && (
                  <span className="text-[11px]" style={{ color: 'var(--muted)' }}>· 🔥 {coins.daily.current_streak}-day streak</span>
                )}
              </div>
            </div>
            <button
              onClick={handleDailyClaim}
              disabled={coins.daily.claimed_today || claiming}
              className="btn btn-primary"
              style={{
                padding: '8px 16px',
                fontSize: 12,
                opacity: coins.daily.claimed_today ? 0.5 : 1,
                cursor: coins.daily.claimed_today ? 'not-allowed' : 'pointer',
              }}
            >
              {claiming ? 'Claiming…' : coins.daily.claimed_today ? '✓ Claimed' : 'Claim'}
            </button>
          </div>
        </div>
      )}

      {/* All earning rules */}
      <div className="rounded-xl p-5 mb-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="text-[10px] uppercase tracking-[1.5px] mb-3" style={{ color: 'var(--muted)' }}>How to earn Bashpoints</div>
        <div className="space-y-2.5">
          <Rule icon="🎁" title={`+${coins?.rules.signup_bonus ?? 50} signup bonus`} desc="One-time, when you verify your email." />
          <Rule icon="🗓️" title={`+${coins?.rules.daily_base ?? 10} daily check-in`} desc="One claim per day. Multiplied by tier." />
          <Rule icon="🥇" title="+100 / +50 / +25 top-3 finish" desc="Per match, multiplied by tier." />
          <Rule icon="⚡" title="Tiers: Bronze 1× · Silver 1.25× · Gold 1.5× · Platinum 2×" desc="Climb tiers based on lifetime Bashpoints earned (redemptions don't demote)." />
        </div>
      </div>

      <Link to="/rewards" className="btn btn-primary block text-center no-underline" style={{ padding: '10px 16px', fontSize: 13 }}>
        🪙 View your Bashpoints →
      </Link>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[1100] rounded-lg px-4 py-3 max-w-md" style={{
          transform: 'translateX(-50%)',
          background: 'rgba(45,214,122,0.15)',
          border: '1px solid rgba(45,214,122,0.4)',
          color: 'var(--green)',
          fontSize: 13,
        }}>{toast}</div>
      )}
    </div>
  );
}

function Rule({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="flex gap-3">
      <div style={{ fontSize: 18, lineHeight: 1.2 }}>{icon}</div>
      <div>
        <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 13, fontWeight: 700 }}>{title}</div>
        <div className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>{desc}</div>
      </div>
    </div>
  );
}
