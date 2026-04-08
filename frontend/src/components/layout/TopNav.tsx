import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export function TopNav() {
  const { user, signInWithGoogle, signOut } = useAuth();
  const location = useLocation();

  const isRoomPage = location.pathname.startsWith('/room/');

  return (
    <nav
      className="flex items-center gap-0 shrink-0 px-8"
      style={{
        borderBottom: '0.5px solid var(--b1)',
        background: 'var(--bg)',
        height: 52,
      }}
    >
      {/* Logo */}
      <Link
        to="/"
        className="font-syne text-lg font-extrabold mr-10"
        style={{ color: 'var(--gold)', letterSpacing: '-0.5px' }}
      >
        Crowdbash
      </Link>

      {/* Nav Links */}
      <div className="flex gap-1 flex-1">
        <Link
          to="/"
          className="px-3.5 py-1.5 rounded-lg text-[13px] transition-all"
          style={{
            color: !isRoomPage ? 'var(--tx)' : 'var(--mu)',
            background: !isRoomPage ? 'var(--s2)' : 'transparent',
          }}
        >
          Rooms
        </Link>
        {isRoomPage && (
          <span
            className="px-3.5 py-1.5 rounded-lg text-[13px]"
            style={{ color: 'var(--tx)', background: 'var(--s2)' }}
          >
            Live Room
          </span>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2.5">
        {isRoomPage && (
          <div
            className="flex items-center gap-[5px] rounded-[20px] px-2.5 py-1 text-[11px] font-semibold"
            style={{
              background: 'rgba(240,90,90,0.12)',
              color: 'var(--red)',
              border: '0.5px solid rgba(240,90,90,0.25)',
            }}
          >
            <div
              className="w-[5px] h-[5px] rounded-full animate-blink"
              style={{ background: 'var(--red)' }}
            />
            Live
          </div>
        )}

        {user ? (
          <button
            onClick={signOut}
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-none cursor-pointer font-syne"
            style={{
              background: 'rgba(244,185,64,0.15)',
              color: 'var(--gold)',
            }}
          >
            {user.username.slice(0, 2).toUpperCase()}
          </button>
        ) : (
          <button
            onClick={signInWithGoogle}
            className="px-4 py-1.5 rounded-lg text-xs font-bold cursor-pointer font-syne border-none"
            style={{ background: 'var(--gold)', color: '#09090F' }}
          >
            Sign in
          </button>
        )}
      </div>
    </nav>
  );
}
