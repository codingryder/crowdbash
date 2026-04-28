import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer
      className="shrink-0 px-4 md:px-9 py-6"
      style={{ borderTop: '1px solid var(--b1)', background: 'var(--bg)' }}
    >
      <div className="flex flex-col items-center gap-2 text-[12px]" style={{ color: 'var(--mu)' }}>
        {/* Free-to-play emphasis */}
        <div className="text-[11px]" style={{ color: 'var(--muted)' }}>
          🆓 Crowdbash is a free-to-play, skill-based fan-engagement game · No entry fees · No real-money stakes
        </div>

        {/* Brand line */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-2">
          <span className="font-cabinet font-bold">Crowdbash 2026</span>
          <span className="hidden md:inline">·</span>
          <Link to="/terms" className="no-underline" style={{ color: 'var(--mu)' }}>Terms</Link>
          <span className="hidden md:inline">·</span>
          <Link to="/privacy" className="no-underline" style={{ color: 'var(--mu)' }}>Privacy</Link>
          <span className="hidden md:inline">·</span>
          <a href="mailto:connect@codingryder.com" className="no-underline" style={{ color: 'var(--mu)' }}>
            connect@codingryder.com
          </a>
          <span className="hidden md:inline">·</span>
          <span>
            Developed by{' '}
            <a
              href="https://codingryder.com"
              target="_blank"
              rel="noopener noreferrer"
              className="no-underline font-semibold"
              style={{ color: 'var(--green)' }}
            >
              Coding Ryder
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}
