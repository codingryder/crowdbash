import { useState } from 'react';
import { useParams } from 'react-router-dom';

const AVATAR_STYLES = [
  { bg: 'rgba(244,185,64,0.12)', color: 'var(--gold)' },
  { bg: 'rgba(168,176,192,0.12)', color: '#A8B4C0' },
  { bg: 'rgba(205,143,90,0.12)', color: '#CD8F5A' },
  { bg: 'rgba(74,158,255,0.15)', color: 'var(--blue)' },
  { bg: 'rgba(240,90,90,0.1)', color: 'var(--red)' },
  { bg: 'rgba(139,111,255,0.1)', color: 'var(--purple)' },
];

const RANK_COLORS = ['var(--gold)', '#A8B4C0', '#CD8F5A', 'var(--gold)', 'var(--dm)', 'var(--dm)'];

// Sample data matching mockup
const SAMPLE_ENTRIES = [
  { name: 'Shubham_K', initials: 'SK', strategy: '4x Kohli, 3x Rohit', points: 1841 },
  { name: 'Priya_A', initials: 'PA', strategy: '3x Kohli, 4x Bumrah', points: 1590 },
  { name: 'MahiVibes', initials: 'MV', strategy: '5x Kohli, 2x Pandya', points: 1402 },
  { name: 'Rakesh_K', initials: 'RK', strategy: '3x Kohli, 2x Rohit', points: 1284, isYou: true },
  { name: 'AussiePhil_7', initials: 'AP', strategy: '4x Maxwell, 3x Head', points: 1107 },
  { name: 'NitinK', initials: 'NK', strategy: '3x Bumrah (oops!)', points: 978 },
];

type TabType = 'game' | 'quiz' | 'combined';

export function LeaderboardPage() {
  const { roomId: _roomId } = useParams<{ roomId: string }>();
  const [activeTab, setActiveTab] = useState<TabType>('game');

  return (
    <main className="px-4 md:px-8 py-6 md:py-7">
      <div className="font-syne text-[22px] font-extrabold mb-1.5">Leaderboard</div>
      <div className="text-[13px] mb-5" style={{ color: 'var(--mu)' }}>
        India vs Australia &middot; Weightage game rankings
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        {([
          { key: 'game', label: 'Game pts' },
          { key: 'quiz', label: 'Quiz pts' },
          { key: 'combined', label: 'Combined' },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="rounded-lg px-4 py-1.5 text-xs font-bold cursor-pointer font-syne border-none"
            style={
              activeTab === tab.key
                ? { background: 'var(--gold)', color: '#09090F' }
                : { background: 'var(--s1)', border: '0.5px solid var(--b1)', color: 'var(--mu)' }
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div
        className="rounded-[14px] overflow-hidden"
        style={{ background: 'var(--s1)', border: '0.5px solid var(--b1)' }}
      >
        {/* Header */}
        <div
          className="grid items-center text-[10px] uppercase tracking-[0.5px] px-4 py-2"
          style={{
            gridTemplateColumns: '50px 48px 1fr 120px 80px',
            borderBottom: '0.5px solid var(--b1)',
            color: 'var(--mu)',
          }}
        >
          <div>Rank</div>
          <div></div>
          <div>Player</div>
          <div>Strategy</div>
          <div className="text-right">Points</div>
        </div>

        {/* Rows */}
        {SAMPLE_ENTRIES.map((entry, i) => {
          const avStyle = AVATAR_STYLES[i % AVATAR_STYLES.length];
          const rankColor = i < 3 ? RANK_COLORS[i] : 'var(--dm)';

          return (
            <div
              key={entry.name}
              className="grid items-center px-4 py-3"
              style={{
                gridTemplateColumns: '50px 48px 1fr 120px 80px',
                borderBottom: '0.5px solid var(--b1)',
                background: entry.isYou ? 'rgba(244,185,64,0.04)' : 'transparent',
                borderLeft: entry.isYou ? '2px solid var(--gold)' : 'none',
              }}
            >
              <div
                className="font-syne font-extrabold"
                style={{ color: rankColor }}
              >
                {i + 1}
              </div>
              <div
                className="w-[34px] h-[34px] rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: avStyle.bg, color: avStyle.color }}
              >
                {entry.initials}
              </div>
              <div className="text-[13px] font-medium">
                {entry.name}
                {entry.isYou && (
                  <span
                    className="text-[10px] ml-1.5 px-[7px] py-px rounded-[20px]"
                    style={{ background: 'rgba(244,185,64,0.15)', color: 'var(--gold)' }}
                  >
                    You
                  </span>
                )}
              </div>
              <div className="text-[11px]" style={{ color: 'var(--mu)' }}>
                {entry.strategy}
              </div>
              <div
                className="text-right font-syne text-[15px] font-bold"
                style={{ color: 'var(--gold)' }}
              >
                {entry.points.toLocaleString()}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
