import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useCoinBalance, useRewards, redeemReward, type Reward } from '../hooks/useCoins';

export function RewardsPage() {
  const { user, openAuthModal } = useAuth();
  const { balance, refresh: refreshBalance } = useCoinBalance();
  const { rewards, loading, error, refresh: refreshRewards } = useRewards();
  const [confirming, setConfirming] = useState<Reward | null>(null);
  const [redeeming, setRedeeming] = useState(false);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  function showToast(kind: 'ok' | 'err', msg: string) {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 4000);
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
              Rewards
            </h1>
            <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 6 }}>
              Earn coins by finishing in the top 3 of a room. Redeem them here.
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
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>coins</span>
            </div>
          )}
        </div>

        {!user && (
          <div className="rounded-xl text-center py-10 px-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <p style={{ color: 'var(--muted)', marginBottom: 16 }}>Sign in to view your balance and redeem rewards.</p>
            <button onClick={openAuthModal} className="btn btn-primary" style={{ padding: '10px 24px' }}>
              Sign in
            </button>
          </div>
        )}

        {loading && <p style={{ color: 'var(--muted)' }}>Loading rewards…</p>}
        {error && <p style={{ color: '#ef4444' }}>{error}</p>}

        {!loading && !error && rewards.length === 0 && (
          <div className="rounded-xl text-center py-10 px-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <p style={{ color: 'var(--muted)' }}>No rewards available yet. Check back soon.</p>
          </div>
        )}

        {/* Grid */}
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
