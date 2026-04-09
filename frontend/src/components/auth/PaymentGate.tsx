import { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import api from '../../lib/api';

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}

interface PaymentGateProps {
  roomId: string;
  roomName: string;
  onSuccess: () => void;
}

export function PaymentGate({ roomId, roomName, onSuccess }: PaymentGateProps) {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handlePayment() {
    setError('');
    setLoading(true);

    try {
      // Step 1: Create order
      const { data: order } = await api.post('/api/payments/create-order', {
        room_id: roomId,
      });

      // Step 2: Open Razorpay checkout
      const options = {
        key: order.key_id,
        amount: order.amount,
        currency: order.currency || 'INR',
        name: 'Crowdbash',
        description: `Join: ${roomName}`,
        order_id: order.order_id,
        handler: async function (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) {
          try {
            // Step 3: Verify payment
            await api.post('/api/payments/verify', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            // Update user payment status locally
            if (user) {
              setUser({ ...user, payment_status: 'paid' });
            }

            onSuccess();
          } catch {
            setError('Payment verification failed. Contact support.');
          }
        },
        prefill: {
          email: user?.email || '',
          contact: user?.phone || '',
          name: `${user?.first_name || ''} ${user?.last_name || ''}`.trim(),
        },
        theme: {
          color: '#F4B940',
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed to create payment';
      setError(msg);
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 52px)' }}>
      <div
        className="rounded-2xl p-8 text-center max-w-md mx-4"
        style={{ background: 'var(--s1)', border: '0.5px solid var(--b1)' }}
      >
        <div className="text-3xl mb-4">🏟️</div>
        <div className="font-syne text-lg font-bold mb-2" style={{ color: 'var(--tx)' }}>
          Join {roomName}
        </div>
        <div className="text-[13px] mb-6" style={{ color: 'var(--mu)' }}>
          Pay ₹10 to access the fan room, play the Weightage Game,
          chat with fans, and compete on leaderboards.
        </div>

        <div
          className="rounded-xl p-4 mb-6"
          style={{ background: 'var(--s2)', border: '0.5px solid var(--b1)' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[13px]" style={{ color: 'var(--mu)' }}>Room Join Fee</span>
            <span className="font-syne text-xl font-bold" style={{ color: 'var(--gold)' }}>₹10</span>
          </div>
        </div>

        {error && (
          <div className="text-[12px] mb-4 px-3 py-2 rounded-lg" style={{ background: 'rgba(240,90,90,0.1)', color: 'var(--red)' }}>
            {error}
          </div>
        )}

        <button
          onClick={handlePayment}
          disabled={loading}
          className="w-full py-3 rounded-lg text-[14px] font-bold cursor-pointer font-syne border-none disabled:opacity-50"
          style={{ background: 'var(--gold)', color: '#09090F' }}
        >
          {loading ? 'Processing...' : 'Pay ₹10 & Join'}
        </button>

        <div className="text-[11px] mt-3" style={{ color: 'var(--dm)' }}>
          Secure payment via Razorpay
        </div>
      </div>
    </div>
  );
}
