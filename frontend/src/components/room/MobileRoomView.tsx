import { useState } from 'react';
import { MatchHeader } from './MatchHeader';
import { CenterColumn } from './CenterColumn';
import { RightGamePanel } from '../game/RightGamePanel';
import { RoomBar } from '../layout/RoomBar';
import type { Room } from '../../types';

type MobileTab = 'match' | 'chat' | 'game';

interface MobileRoomViewProps {
  room: Room;
  fanCount: number;
  lastUpdated: Date | null;
  onRefresh: () => void;
  onSendChat: (message: string) => void;
}

export function MobileRoomView({ room, fanCount, lastUpdated: _lastUpdated, onRefresh: _onRefresh, onSendChat }: MobileRoomViewProps) {
  const [activeTab, setActiveTab] = useState<MobileTab>('match');

  return (
    <div className="flex flex-col h-full">
      {/* Score header — always visible */}
      <MatchHeader room={room} />

      {/* Mobile tabs */}
      <div
        className="flex shrink-0"
        style={{ borderBottom: '0.5px solid var(--b1)', background: 'var(--bg)' }}
      >
        {([
          { key: 'match', label: 'Match' },
          { key: 'chat', label: 'Chat & Team' },
          { key: 'game', label: 'Game' },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="flex-1 py-2.5 text-[12px] relative transition-colors bg-transparent border-none cursor-pointer"
            style={{
              color: activeTab === tab.key ? 'var(--gold)' : 'var(--mu)',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {tab.label}
            {activeTab === tab.key && (
              <span
                className="absolute bottom-0 left-[15%] right-[15%] h-[1.5px] rounded"
                style={{ background: 'var(--gold)' }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'match' && (
          <div style={{ padding: '12px 16px' }}>
            {/* Match info */}
            <div className="mb-3">
              {room.venue && (
                <div className="text-[11px] mb-1" style={{ color: 'var(--mu)' }}>📍 {room.venue}</div>
              )}
              {room.league && (
                <div className="text-[11px]" style={{ color: 'var(--mu)' }}>🏆 {room.league}</div>
              )}
            </div>

            {/* Scorecard button */}
            {(room.status === 'live' || room.status === 'completed') && (
              <div className="text-[11px] text-center py-2" style={{ color: 'var(--gold)' }}>
                Tap "Chat & Team" for live chat, or "Game" for your fantasy XI
              </div>
            )}
          </div>
        )}

        {activeTab === 'chat' && (
          <CenterColumn onSendChat={onSendChat} room={room} />
        )}

        {activeTab === 'game' && (
          <RightGamePanel room={room} />
        )}
      </div>

      {/* Bottom bar */}
      <RoomBar room={room} fanCount={fanCount} />
    </div>
  );
}
