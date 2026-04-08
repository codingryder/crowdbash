import { useGameStore } from '../../store/gameStore';

const RANK_COLORS = ['var(--gold)', '#A8B4C0', '#CD8F5A'];
const AVATAR_STYLES = [
  { bg: 'rgba(244,185,64,0.12)', color: 'var(--gold)' },
  { bg: 'rgba(168,176,192,0.12)', color: '#A8B4C0' },
  { bg: 'rgba(205,143,90,0.12)', color: '#CD8F5A' },
  { bg: 'rgba(74,158,255,0.15)', color: 'var(--blue)' },
  { bg: 'rgba(240,90,90,0.1)', color: 'var(--red)' },
  { bg: 'rgba(139,111,255,0.1)', color: 'var(--purple)' },
  { bg: 'rgba(61,214,140,0.1)', color: 'var(--green)' },
];

// Sample data for mockup display
const SAMPLE_LEADERS = [
  { id: '1', name: 'Shubham_K', initials: 'SK', points: 1841 },
  { id: '2', name: 'Priya_A', initials: 'PA', points: 1590 },
  { id: '3', name: 'MahiVibes', initials: 'MV', points: 1402 },
  { id: '4', name: 'You', initials: 'RK', points: 1284, isYou: true },
  { id: '5', name: 'AussiePhil_7', initials: 'AP', points: 1107 },
  { id: '6', name: 'NitinK', initials: 'NK', points: 978 },
  { id: '7', name: 'RStar24', initials: 'RS', points: 891 },
  { id: '8', name: 'DhoniMagic', initials: 'DM', points: 764 },
  { id: '9', name: 'CricKing99', initials: 'CK', points: 702 },
  { id: '10', name: 'ViratBhakt', initials: 'VB', points: 688 },
];

export function LeaderboardSidebar() {
  const leaderboard = useGameStore((s) => s.leaderboard);

  // Use real data if available, otherwise sample
  const leaders = leaderboard.length > 0
    ? leaderboard.map((e, _i) => ({
        id: e.user_id,
        name: e.username || e.user_id.slice(0, 8),
        initials: (e.username || e.user_id).slice(0, 2).toUpperCase(),
        points: e.points,
        isYou: false,
      }))
    : SAMPLE_LEADERS;

  return (
    <div style={{ padding: '12px 0' }}>
      <div
        className="text-[9px] uppercase tracking-[1px] px-4 pb-1"
        style={{ color: 'var(--mu)' }}
      >
        Game leaderboard
      </div>
      {leaders.map((entry, i) => {
        const avStyle = AVATAR_STYLES[i % AVATAR_STYLES.length];
        const rankColor = i < 3 ? RANK_COLORS[i] : 'var(--dm)';
        const isYou = 'isYou' in entry && entry.isYou;

        return (
          <div
            key={entry.id}
            className="flex items-center gap-2.5"
            style={{
              padding: '8px 16px',
              borderBottom: '0.5px solid var(--b1)',
              background: isYou ? 'rgba(244,185,64,0.05)' : 'transparent',
              borderColor: isYou ? 'rgba(244,185,64,0.15)' : undefined,
            }}
          >
            {/* Rank */}
            <div
              className="font-syne text-[13px] font-extrabold min-w-[20px] text-center"
              style={{ color: rankColor }}
            >
              {i + 1}
            </div>

            {/* Avatar */}
            <div
              className="w-[30px] h-[30px] rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
              style={{ background: avStyle.bg, color: avStyle.color }}
            >
              {entry.initials}
            </div>

            {/* Name */}
            <div className="text-xs font-medium flex-1">
              {entry.name}
              {isYou && (
                <span className="text-[9px] ml-1" style={{ color: 'var(--gold)' }}>
                  You
                </span>
              )}
            </div>

            {/* Points */}
            <div
              className="font-syne text-[13px] font-bold"
              style={{ color: 'var(--gold)' }}
            >
              {entry.points.toLocaleString()}
            </div>
          </div>
        );
      })}
    </div>
  );
}
