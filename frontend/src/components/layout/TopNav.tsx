import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Avatar } from '../ui/Avatar';

export function TopNav() {
  const { user, signInWithGoogle, signOut } = useAuth();

  return (
    <nav className="sticky top-0 z-50 bg-surface/80 backdrop-blur-md border-b border-white/[0.07]">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-gold font-syne font-bold text-xl">Crowdbash</span>
        </Link>

        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-3">
              <Link
                to="/profile"
                className="flex items-center gap-2 hover:opacity-80 transition"
              >
                <Avatar url={user.avatar_url} username={user.username} size="sm" />
                <span className="text-sm text-white/70">{user.username}</span>
              </Link>
              <button
                onClick={signOut}
                className="text-xs text-white/40 hover:text-white/60 transition"
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              onClick={signInWithGoogle}
              className="px-4 py-1.5 bg-gold text-bg text-sm font-semibold rounded-lg hover:bg-gold/90 transition"
            >
              Sign in
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
