import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

/**
 * One-time prompt that surfaces the Terms + Privacy + 18+ acceptance for
 * users created BEFORE these legal pages existed. Renders once they sign
 * in and `user.terms_accepted_at` is null. After acceptance, the API
 * stamps the user row and the modal stops appearing.
 */
export function TermsAcceptModal() {
  const { user, acceptTerms } = useAuth();
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Show only when signed in AND not yet accepted.
  const needsAcceptance = !!user && !user.terms_accepted_at;
  if (!needsAcceptance) return null;

  async function handleAccept() {
    if (!accepted) {
      setError('Please confirm you are 18+ and accept the Terms.');
      return;
    }
    setLoading(true);
    try {
      await acceptTerms();
    } catch {
      setError('Could not save your acceptance. Please retry.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="rounded-2xl w-full max-w-md mx-4"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 18, fontWeight: 900 }}>
            Quick update — please review
          </div>
          <div className="text-[12px] mt-1" style={{ color: 'var(--muted)' }}>
            We've published Terms and a Privacy Policy. Please confirm to keep using Crowdbash.
          </div>
        </div>

        <div className="px-6 py-5 text-[13px]" style={{ color: 'var(--text2)', lineHeight: 1.65 }}>
          <p style={{ marginBottom: 12 }}>
            Crowdbash is a <strong>free-to-play, skill-based</strong> sports
            fan-engagement game. There are no entry fees, no real-money
            stakes, and no winnings pool. Bashpoints have no monetary value.
          </p>

          <label className="flex items-start gap-2 cursor-pointer mt-4" style={{ fontSize: 13 }}>
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => { setAccepted(e.target.checked); setError(''); }}
              style={{ marginTop: 4, accentColor: '#2dd67a', cursor: 'pointer' }}
            />
            <span>
              I'm 18+ and agree to the{' '}
              <Link to="/terms" target="_blank" style={{ color: 'var(--green)' }}>Terms of Service</Link>
              {' '}and{' '}
              <Link to="/privacy" target="_blank" style={{ color: 'var(--green)' }}>Privacy Policy</Link>.
            </span>
          </label>

          {error && (
            <div className="text-[12px] mt-3 px-3 py-2 rounded-lg" style={{ background: 'rgba(240,90,90,0.1)', color: 'var(--red)' }}>
              {error}
            </div>
          )}
        </div>

        <div className="px-6 py-4 flex justify-end" style={{ borderTop: '1px solid var(--border)' }}>
          <button
            onClick={handleAccept}
            disabled={loading || !accepted}
            className="btn btn-primary"
            style={{ padding: '10px 22px', fontSize: 13, opacity: !accepted ? 0.5 : 1 }}
          >
            {loading ? 'Saving…' : 'Confirm and continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
