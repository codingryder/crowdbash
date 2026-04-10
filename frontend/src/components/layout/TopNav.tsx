import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export function TopNav() {
  const { user, openAuthModal, logout } = useAuth();
  const location = useLocation();
  const isRoomPage = location.pathname.startsWith('/room/');

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-[900] flex items-center justify-between px-4 md:px-9"
      style={{
        height: 60,
        background: 'rgba(26,27,30,0.88)',
        borderBottom: '1px solid var(--b1)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      {/* Logo */}
      <Link to="/" className="flex items-center gap-2 no-underline cursor-pointer">
        <div
          className="w-[26px] h-[26px] rounded-[7px] flex items-center justify-center shrink-0"
          style={{ background: 'var(--green)' }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <polygon points="7,1 13,5 13,9 7,13 1,9 1,5" fill="#071a0e" />
          </svg>
        </div>
        <span className="font-cabinet text-[19px] font-black" style={{ letterSpacing: '-0.3px' }}>
          Crowdbash
        </span>
      </Link>

      {/* Sport tabs (hidden on mobile room pages) */}
      {!isRoomPage && (
        <div className="hidden md:flex items-center gap-0.5 rounded-full" style={{ background: 'var(--surface)', padding: 3 }}>
          <Link
            to="/"
            className="flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[12px] font-semibold no-underline transition-all"
            style={{ background: 'var(--surface3)', color: 'var(--tx)' }}
          >
            <span className="text-[13px]">🏏</span> Cricket
          </Link>
          <Link
            to="/"
            className="flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[12px] font-semibold no-underline transition-all"
            style={{ color: 'var(--mu)' }}
          >
            <span className="text-[13px]">⚽</span> Football
          </Link>
        </div>
      )}

      {/* Live indicator on room pages */}
      {isRoomPage && (
        <div
          className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold font-cabinet tracking-wide"
          style={{ background: 'rgba(240,82,82,0.12)', color: 'var(--red)', border: '1px solid rgba(240,82,82,0.2)' }}
        >
          <span className="animate-pulse-slow">●</span> LIVE
        </div>
      )}

      {/* Right */}
      <div className="flex items-center gap-2.5">
        <Link
          to="/"
          className="hidden md:block text-[13px] px-1 no-underline transition-colors"
          style={{ color: 'var(--mu)' }}
        >
          Games
        </Link>

        {user ? (
          <>
            <Link to="/profile" className="flex items-center gap-2 no-underline">
              <div
                className="w-8 h-8 rounded-[8px] flex items-center justify-center text-[10px] font-cabinet font-bold shrink-0"
                style={{ background: 'rgba(45,214,122,0.12)', color: 'var(--green)' }}
              >
                {(user.first_name?.[0] || '').toUpperCase()}{(user.last_name?.[0] || '').toUpperCase()}
              </div>
              <span className="hidden md:inline text-[13px]" style={{ color: 'var(--mu)' }}>
                {user.first_name}
              </span>
            </Link>
            <button
              onClick={logout}
              className="text-[11px] bg-transparent border-none px-1.5 py-1"
              style={{ color: 'var(--mu)' }}
            >
              Logout
            </button>
          </>
        ) : (
          <button
            onClick={openAuthModal}
            className="font-cabinet text-[13px] font-bold border-none rounded-btn px-5 py-2 transition-all"
            style={{ background: 'var(--green)', color: '#071a0e' }}
          >
            Play now
          </button>
        )}
      </div>
    </nav>
  );
}
