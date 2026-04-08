import { useAuth } from '../hooks/useAuth';
import { Avatar } from '../components/ui/Avatar';

export function ProfilePage() {
  const { user, isLoading, signOut } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-white/30 font-syne">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-white/30 font-syne">Please sign in to view your profile.</div>
      </div>
    );
  }

  return (
    <main className="max-w-lg mx-auto px-4 py-8">
      <div className="bg-surface2 rounded-xl border border-white/[0.07] p-6">
        <div className="flex items-center gap-4 mb-6">
          <Avatar url={user.avatar_url} username={user.username} size="lg" />
          <div>
            <h1 className="font-syne font-bold text-xl">{user.username}</h1>
            <p className="text-xs text-white/40">Member</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-surface3 rounded-lg p-3 text-center">
            <p className="font-syne font-bold text-lg text-gold">{user.total_games}</p>
            <p className="text-xs text-white/40">Games</p>
          </div>
          <div className="bg-surface3 rounded-lg p-3 text-center">
            <p className="font-syne font-bold text-lg text-fangreen">{user.total_wins}</p>
            <p className="text-xs text-white/40">Wins</p>
          </div>
          <div className="bg-surface3 rounded-lg p-3 text-center">
            <p className="font-syne font-bold text-lg text-fanpurple">{user.weightage_balance}</p>
            <p className="text-xs text-white/40">Extra WP</p>
          </div>
        </div>

        <button
          onClick={signOut}
          className="w-full py-2 bg-fanred/10 text-fanred text-sm font-semibold rounded-lg border border-fanred/20 hover:bg-fanred/20 transition"
        >
          Sign Out
        </button>
      </div>
    </main>
  );
}
