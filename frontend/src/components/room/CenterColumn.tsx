import { useState } from 'react';
import { CommentaryFeed } from './CommentaryFeed';
import { ChatPanel, ChatInput } from './ChatPanel';
import { QuizPanel } from './QuizPanel';
import { MyTeamTab } from './MyTeamTab';
import { LeaderboardTab } from './LeaderboardTab';
import type { Room } from '../../types';

type CenterTab = 'commentary' | 'chat' | 'quiz' | 'my-team' | 'leaderboard';

interface CenterColumnProps {
  onSendChat: (message: string) => void;
  room: Room;
}

export function CenterColumn({ onSendChat, room }: CenterColumnProps) {
  const [activeTab, setActiveTab] = useState<CenterTab>('commentary');

  const tabs: Array<{ key: CenterTab; label: string }> = [
    { key: 'commentary', label: 'Commentary' },
    { key: 'chat', label: 'Chat' },
    { key: 'my-team', label: 'My Team' },
    { key: 'leaderboard', label: 'Leaderboard' },
    { key: 'quiz', label: 'Quiz' },
  ];

  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{ borderRight: '0.5px solid var(--b1)' }}
    >
      {/* Tabs */}
      <div
        className="flex px-1 shrink-0 overflow-x-auto"
        style={{ borderBottom: '0.5px solid var(--b1)', background: 'var(--bg)' }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="px-3 py-2.5 text-[11px] relative transition-colors bg-transparent border-none cursor-pointer whitespace-nowrap"
            style={{
              color: activeTab === tab.key ? 'var(--gold)' : 'var(--mu)',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {tab.label}
            {activeTab === tab.key && (
              <span
                className="absolute bottom-0 left-[10%] right-[10%] h-[1.5px] rounded"
                style={{ background: 'var(--gold)' }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'commentary' && <CommentaryFeed room={room} />}
        {activeTab === 'chat' && <ChatPanel onSendChat={onSendChat} />}
        {activeTab === 'quiz' && <QuizPanel />}
        {activeTab === 'my-team' && <MyTeamTab roomId={room.id} />}
        {activeTab === 'leaderboard' && <LeaderboardTab roomId={room.id} />}
      </div>

      {activeTab === 'chat' && <ChatInput onSendChat={onSendChat} />}
    </div>
  );
}
