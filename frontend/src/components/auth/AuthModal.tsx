import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

type AuthStep = 'form' | 'otp';
type AuthMode = 'signup' | 'signin';

export function AuthModal() {
  const { showAuthModal, closeAuthModal, signup, signin, verifyOtp } = useAuth();
  const [mode, setMode] = useState<AuthMode>('signup');
  const [step, setStep] = useState<AuthStep>('form');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  if (!showAuthModal) return null;

  async function handleSubmitForm() {
    setError('');
    setLoading(true);
    try {
      if (mode === 'signup') {
        if (!firstName.trim() || !lastName.trim() || !email.trim()) {
          setError('Please fill in all required fields');
          setLoading(false);
          return;
        }
        if (!termsAccepted) {
          setError('Please accept the Terms (incl. 18+) and Privacy Policy to continue.');
          setLoading(false);
          return;
        }
        await signup(firstName.trim(), lastName.trim(), email.trim(), phone.trim(), termsAccepted);
      } else {
        if (!email.trim()) {
          setError('Please enter your email');
          setLoading(false);
          return;
        }
        await signin(email.trim());
      }
      setStep('otp');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Something went wrong';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    setError('');
    setLoading(true);
    try {
      if (!otp.trim() || otp.length !== 6) {
        setError('Please enter a valid 6-digit code');
        setLoading(false);
        return;
      }
      await verifyOtp(email.trim(), otp.trim());
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Invalid OTP';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setStep('form');
    setError('');
    setOtp('');
    closeAuthModal();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={handleClose}
    >
      <div
        className="rounded-2xl w-full max-w-md mx-4"
        style={{ background: 'var(--s1)', border: '0.5px solid var(--b1)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '0.5px solid var(--b1)' }}>
          <div className="font-syne text-lg font-bold" style={{ color: 'var(--gold)' }}>
            {step === 'otp' ? 'Verify Email' : mode === 'signup' ? 'Create Account' : 'Welcome Back'}
          </div>
          <button
            onClick={handleClose}
            className="text-lg cursor-pointer bg-transparent border-none"
            style={{ color: 'var(--mu)' }}
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-5">
          {step === 'form' ? (
            <>
              {mode === 'signup' && (
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-[11px] mb-1" style={{ color: 'var(--mu)' }}>First Name *</label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="CXXX"
                      className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none"
                      style={{ background: 'var(--s2)', border: '0.5px solid var(--b2)', color: 'var(--tx)', fontFamily: "'DM Sans', sans-serif" }}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] mb-1" style={{ color: 'var(--mu)' }}>Last Name *</label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="RXXX"
                      className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none"
                      style={{ background: 'var(--s2)', border: '0.5px solid var(--b2)', color: 'var(--tx)', fontFamily: "'DM Sans', sans-serif" }}
                    />
                  </div>
                </div>
              )}

              <div className="mb-3">
                <label className="block text-[11px] mb-1" style={{ color: 'var(--mu)' }}>Email *</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none"
                  style={{ background: 'var(--s2)', border: '0.5px solid var(--b2)', color: 'var(--tx)', fontFamily: "'DM Sans', sans-serif" }}
                />
              </div>

              {mode === 'signup' && (
                <div className="mb-4">
                  <label className="block text-[11px] mb-1" style={{ color: 'var(--mu)' }}>Phone Number</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+9198XXXXXXXX"
                    className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none"
                    style={{ background: 'var(--s2)', border: '0.5px solid var(--b2)', color: 'var(--tx)', fontFamily: "'DM Sans', sans-serif" }}
                  />
                </div>
              )}

              {mode === 'signup' && (
                <label className="flex items-start gap-2 mb-4 cursor-pointer" style={{ fontSize: 12, color: 'var(--mu)', lineHeight: 1.5 }}>
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    style={{ marginTop: 3, accentColor: '#2dd67a', cursor: 'pointer' }}
                  />
                  <span>
                    I'm 18+ and agree to the{' '}
                    <Link to="/terms" target="_blank" style={{ color: 'var(--green)' }}>Terms</Link>
                    {' '}and{' '}
                    <Link to="/privacy" target="_blank" style={{ color: 'var(--green)' }}>Privacy Policy</Link>.
                    Crowdbash is a free-to-play, skill-based fan-engagement game.
                  </span>
                </label>
              )}

              {error && (
                <div className="text-[12px] mb-3 px-3 py-2 rounded-lg" style={{ background: 'rgba(240,90,90,0.1)', color: 'var(--red)' }}>
                  {error}
                </div>
              )}

              <button
                onClick={handleSubmitForm}
                disabled={loading || (mode === 'signup' && !termsAccepted)}
                className="w-full py-3 rounded-lg text-[14px] font-bold cursor-pointer font-syne border-none disabled:opacity-50"
                style={{ background: 'var(--gold)', color: '#09090F' }}
              >
                {loading ? 'Sending OTP...' : mode === 'signup' ? 'Send Verification Code' : 'Send Login Code'}
              </button>

              <div className="text-center mt-4">
                <button
                  onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setError(''); }}
                  className="text-[12px] bg-transparent border-none cursor-pointer"
                  style={{ color: 'var(--gold)' }}
                >
                  {mode === 'signup' ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="text-[13px] mb-4" style={{ color: 'var(--mu)' }}>
                We've sent a 6-digit code to <span style={{ color: 'var(--tx)' }}>{email}</span>
              </div>

              <div className="mb-4">
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Enter 6-digit code"
                  maxLength={6}
                  className="w-full px-4 py-3 rounded-lg text-center text-xl font-bold tracking-[8px] outline-none font-syne"
                  style={{ background: 'var(--s2)', border: '0.5px solid var(--b2)', color: 'var(--gold)' }}
                  autoFocus
                />
              </div>

              {error && (
                <div className="text-[12px] mb-3 px-3 py-2 rounded-lg" style={{ background: 'rgba(240,90,90,0.1)', color: 'var(--red)' }}>
                  {error}
                </div>
              )}

              <button
                onClick={handleVerifyOtp}
                disabled={loading || otp.length !== 6}
                className="w-full py-3 rounded-lg text-[14px] font-bold cursor-pointer font-syne border-none disabled:opacity-50"
                style={{ background: 'var(--gold)', color: '#09090F' }}
              >
                {loading ? 'Verifying...' : 'Verify & Sign In'}
              </button>

              <button
                onClick={() => { setStep('form'); setOtp(''); setError(''); }}
                className="w-full mt-3 text-[12px] bg-transparent border-none cursor-pointer"
                style={{ color: 'var(--mu)' }}
              >
                ← Back to form
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
