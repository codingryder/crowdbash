import { useState } from 'react';
import { MatchHeader } from './MatchHeader';
import { LeaderboardSidebar } from './LeaderboardSidebar';
import { StatsSidebar } from './StatsSidebar';
import type { Room } from '../../types';

type LeftTab = 'leaders' | 'stats';

interface LeftSidebarProps {
  room: Room;
}

export function LeftSidebar({ room }: LeftSidebarProps) {
  const [activeTab, setActiveTab] = useState<LeftTab>('leaders');

  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{ borderRight: '0.5px solid var(--b1)' }}
    >
      <MatchHeader room={room} />

      {/* Tabs */}
      <div
        className="flex px-2"
        style={{ borderBottom: '0.5px solid var(--b1)' }}
      >
        {(['leaders', 'stats'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex-1 py-2 px-1 text-[11px] relative transition-colors bg-transparent border-none cursor-pointer"
            style={{
              color: activeTab === tab ? 'var(--gold)' : 'var(--mu)',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {tab === 'leaders' ? 'Leaders' : 'Stats'}
            {activeTab === tab && (
              <span
                className="absolute bottom-0 left-[15%] right-[15%] h-[1.5px] rounded"
                style={{ background: 'var(--gold)' }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'leaders' ? <LeaderboardSidebar /> : <StatsSidebar />}
      </div>
    </div>
  );
}
