import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export function TopNav() {
  const { user, openAuthModal, logout } = useAuth();
  const location = useLocation();
  const isRoomPage = location.pathname.startsWith('/room/');

  return (
    <nav
      className="flex items-center shrink-0 px-3 md:px-8 gap-2 md:gap-0"
      style={{ borderBottom: '0.5px solid var(--b1)', background: 'var(--bg)', height: 48 }}
    >
      {/* Logo */}
      <Link
        to="/"
        className="font-syne text-base md:text-lg font-extrabold no-underline shrink-0"
        style={{ color: 'var(--gold)', letterSpacing: '-0.5px' }}
      >
        Crowdbash
      </Link>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Nav links — hidden on mobile room pages to save space */}
      {!isRoomPage && (
        <Link
          to="/"
          className="hidden md:block px-3 py-1.5 rounded-lg text-[13px] transition-all no-underline"
          style={{ color: 'var(--tx)', background: 'var(--s2)' }}
        >
          Rooms
        </Link>
      )}

      {/* Live pill — compact on mobile */}
      {isRoomPage && (
        <div
          className="flex items-center gap-1 rounded-[20px] px-2 py-0.5 text-[10px] md:text-[11px] font-semibold"
          style={{ background: 'rgba(240,90,90,0.12)', color: 'var(--red)', border: '0.5px solid rgba(240,90,90,0.25)' }}
        >
          <div className="w-1 h-1 md:w-[5px] md:h-[5px] rounded-full animate-blink" style={{ background: 'var(--red)' }} />
          Live
        </div>
      )}

      {/* User section */}
      {user ? (
        <div className="flex items-center gap-1.5 md:gap-2">
          <Link to="/profile" className="flex items-center gap-1.5 no-underline">
            <div
              className="w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center text-[10px] md:text-xs font-bold font-syne"
              style={{ background: 'rgba(244,185,64,0.15)', color: 'var(--gold)' }}
            >
              {(user.first_name?.[0] || '').toUpperCase()}{(user.last_name?.[0] || '').toUpperCase()}
            </div>
            <span className="hidden md:inline text-[12px]" style={{ color: 'var(--mu)' }}>
              {user.first_name}
            </span>
          </Link>
          <button
            onClick={logout}
            className="text-[10px] md:text-[11px] bg-transparent border-none cursor-pointer px-1.5 py-1 rounded"
            style={{ color: 'var(--dm)' }}
          >
            Logout
          </button>
        </div>
      ) : (
        <button
          onClick={openAuthModal}
          className="px-3 md:px-4 py-1.5 rounded-lg text-[11px] md:text-xs font-bold cursor-pointer font-syne border-none shrink-0"
          style={{ background: 'var(--gold)', color: '#09090F' }}
        >
          Sign in
        </button>
      )}
    </nav>
  );
}
