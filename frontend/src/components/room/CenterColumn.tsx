import { useState } from 'react';
import { CommentaryFeed } from './CommentaryFeed';
import { ChatPanel, ChatInput } from './ChatPanel';
import { QuizPanel } from './QuizPanel';

type CenterTab = 'commentary' | 'chat' | 'quiz';

interface CenterColumnProps {
  onSendChat: (message: string) => void;
}

export function CenterColumn({ onSendChat }: CenterColumnProps) {
  const [activeTab, setActiveTab] = useState<CenterTab>('commentary');

  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{ borderRight: '0.5px solid var(--b1)' }}
    >
      {/* Tabs */}
      <div
        className="flex px-2 shrink-0"
        style={{ borderBottom: '0.5px solid var(--b1)', background: 'var(--bg)' }}
      >
        {(['commentary', 'chat', 'quiz'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="px-3.5 py-2.5 text-xs relative transition-colors bg-transparent border-none cursor-pointer capitalize"
            style={{
              color: activeTab === tab ? 'var(--gold)' : 'var(--mu)',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {tab}
            {activeTab === tab && (
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
        {activeTab === 'commentary' && <CommentaryFeed />}
        {activeTab === 'chat' && <ChatPanel onSendChat={onSendChat} />}
        {activeTab === 'quiz' && <QuizPanel />}
      </div>

      {/* Chat input - only shown on chat tab */}
      {activeTab === 'chat' && <ChatInput onSendChat={onSendChat} />}
    </div>
  );
}
