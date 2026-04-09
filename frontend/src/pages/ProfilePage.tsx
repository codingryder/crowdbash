import { useAuth } from '../hooks/useAuth';

export function ProfilePage() {
  const { user, isLoading, logout } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 52px)' }}>
        <div className="font-syne" style={{ color: 'var(--mu)' }}>Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 52px)' }}>
        <div className="font-syne" style={{ color: 'var(--mu)' }}>Please sign in to view your profile.</div>
      </div>
    );
  }

  return (
    <main className="px-4 md:px-8 py-6 md:py-7 mx-auto" style={{ maxWidth: 500 }}>
      <div className="rounded-2xl p-6" style={{ background: 'var(--s1)', border: '0.5px solid var(--b1)' }}>
        {/* Avatar + Name */}
        <div className="flex items-center gap-4 mb-6">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold font-syne"
            style={{ background: 'rgba(244,185,64,0.15)', color: 'var(--gold)' }}
          >
            {(user.first_name?.[0] || '').toUpperCase()}{(user.last_name?.[0] || '').toUpperCase()}
          </div>
          <div>
            <div className="font-syne text-lg font-bold" style={{ color: 'var(--tx)' }}>
              {user.first_name} {user.last_name}
            </div>
            <div className="text-[12px]" style={{ color: 'var(--mu)' }}>{user.email}</div>
          </div>
        </div>

        {/* Details */}
        <div className="space-y-3 mb-6">
          {[
            { label: 'Phone', value: user.phone || 'Not provided' },
            { label: 'Username', value: user.username },
            { label: 'Payment Status', value: user.payment_status === 'paid' ? '✅ Paid' : '⏳ Pending' },
          ].map((item) => (
            <div key={item.label} className="flex justify-between py-2" style={{ borderBottom: '0.5px solid var(--b1)' }}>
              <span className="text-[12px]" style={{ color: 'var(--mu)' }}>{item.label}</span>
              <span className="text-[12px] font-medium" style={{ color: 'var(--tx)' }}>{item.value}</span>
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="rounded-lg p-3 text-center" style={{ background: 'var(--s2)' }}>
            <div className="font-syne text-lg font-bold" style={{ color: 'var(--gold)' }}>{user.total_games}</div>
            <div className="text-[10px]" style={{ color: 'var(--mu)' }}>Games</div>
          </div>
          <div className="rounded-lg p-3 text-center" style={{ background: 'var(--s2)' }}>
            <div className="font-syne text-lg font-bold" style={{ color: 'var(--green)' }}>{user.total_wins}</div>
            <div className="text-[10px]" style={{ color: 'var(--mu)' }}>Wins</div>
          </div>
          <div className="rounded-lg p-3 text-center" style={{ background: 'var(--s2)' }}>
            <div className="font-syne text-lg font-bold" style={{ color: 'var(--purple)' }}>{user.weightage_balance}</div>
            <div className="text-[10px]" style={{ color: 'var(--mu)' }}>Extra WP</div>
          </div>
        </div>

        <button
          onClick={logout}
          className="w-full py-2 rounded-lg text-[13px] font-semibold cursor-pointer border-none"
          style={{ background: 'rgba(240,90,90,0.1)', color: 'var(--red)', border: '0.5px solid rgba(240,90,90,0.2)' }}
        >
          Sign Out
        </button>
      </div>
    </main>
  );
}
