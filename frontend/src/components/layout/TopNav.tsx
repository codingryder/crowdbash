import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export function TopNav() {
  const { user, openAuthModal, logout } = useAuth();

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-[900] flex items-center justify-between"
      style={{
        height: 60,
        padding: '0 36px',
        background: 'rgba(26,27,30,0.88)',
        borderBottom: '1px solid var(--border)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      {/* Logo */}
      <Link to="/" className="flex items-center gap-2 no-underline" style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 19, fontWeight: 900, letterSpacing: '-0.3px' }}>
        <div className="w-[26px] h-[26px] rounded-[7px] flex items-center justify-center shrink-0" style={{ background: 'var(--green)' }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><polygon points="7,1 13,5 13,9 7,13 1,9 1,5" fill="#071a0e"/></svg>
        </div>
        Crowdbash
      </Link>

      {/* Sport tabs */}
      <div className="hidden md:flex items-center gap-0.5 rounded-full" style={{ background: 'var(--surface)', padding: 3 }}>
        <div className="flex items-center gap-1.5 rounded-full text-[12px] font-semibold" style={{ padding: '5px 16px', background: 'var(--surface3)', color: 'var(--text)' }}>
          <span className="text-[13px]">🏏</span> Cricket
        </div>
        <div className="flex items-center gap-1.5 rounded-full text-[12px] font-semibold" style={{ padding: '5px 16px', color: 'var(--muted)' }}>
          <span className="text-[13px]">⚽</span> Football
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2.5">
        <Link to="/games" className="text-[13px] px-1 no-underline hidden md:block" style={{ color: 'var(--muted)' }}>Games</Link>
        {user ? (
          <>
            <Link to="/profile" className="flex items-center gap-2 no-underline">
              <div className="w-8 h-8 rounded-[8px] flex items-center justify-center text-[10px] font-bold shrink-0" style={{ fontFamily: "'Cabinet Grotesk', sans-serif", background: 'rgba(45,214,122,0.12)', color: 'var(--green)' }}>
                {(user.first_name?.[0] || '').toUpperCase()}{(user.last_name?.[0] || '').toUpperCase()}
              </div>
              <span className="hidden md:inline text-[13px]" style={{ color: 'var(--muted)' }}>{user.first_name}</span>
            </Link>
            <button onClick={logout} className="text-[11px] bg-transparent border-none px-1" style={{ color: 'var(--muted)' }}>Logout</button>
          </>
        ) : (
          <button
            onClick={openAuthModal}
            className="btn btn-primary"
            style={{ padding: '8px 20px', fontSize: 13 }}
          >
            Play now
          </button>
        )}
      </div>
    </nav>
  );
}
