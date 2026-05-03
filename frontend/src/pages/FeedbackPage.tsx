import { Link } from 'react-router-dom';
import { FeedbackPanel } from '../components/room/FeedbackPanel';
import { useSeo } from '../hooks/useSeo';

export function FeedbackPage() {
  useSeo({
    title: 'Feedback | Crowdbash',
    description:
      'Share feedback or report issues for Crowdbash cricket game rooms — squad picks, power allocation, live scorecard, quiz, leaderboard, and more.',
    path: '/feedback',
  });

  return (
    <div
      style={{
        paddingTop: 64,
        paddingBottom: 64,
        minHeight: '100vh',
        background: 'var(--bg)',
      }}
    >
      <div
        style={{
          maxWidth: 760,
          margin: '0 auto',
          padding: '0 16px',
        }}
      >
        <div className="text-[12px] mb-4" style={{ color: 'var(--muted)' }}>
          <Link to="/" className="no-underline" style={{ color: 'var(--muted)' }}>
            ← Back to home
          </Link>
        </div>

        <div
          style={{
            background: 'var(--bg2)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            overflow: 'hidden',
          }}
        >
          <FeedbackPanel context="site" />
        </div>
      </div>
    </div>
  );
}
