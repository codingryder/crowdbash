import { useParams } from 'react-router-dom';
import { useRoom } from '../hooks/useRoom';
import { useWebSocket } from '../hooks/useWebSocket';
import { useGame } from '../hooks/useGame';
import { useRoomStore } from '../store/roomStore';
import { RoomBar } from '../components/layout/RoomBar';
import { LeftSidebar } from '../components/room/LeftSidebar';
import { CenterColumn } from '../components/room/CenterColumn';
import { RightGamePanel } from '../components/game/RightGamePanel';

export function CrowdbashRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const { room, loading } = useRoom(roomId);
  const { sendChat } = useWebSocket(roomId);
  useGame(roomId);
  const fanCount = useRoomStore((s) => s.fanCount);

  // For demo purposes, create a placeholder room
  const displayRoom = room || {
    id: roomId || 'demo',
    match_id: 'demo',
    match_name: 'India vs Australia',
    match_format: 'ODI',
    venue: 'MCG',
    status: 'live' as const,
    current_over: 48.3,
    fan_count: 2841,
  };

  const displayFanCount = fanCount > 0 ? fanCount : 2841;

  if (loading && !room) {
    return (
      <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 52px)' }}>
        <div className="font-syne" style={{ color: 'var(--mu)' }}>Loading room...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 52px)' }}>
      {/* 3-column layout */}
      <div
        className="flex-1 grid overflow-hidden"
        style={{
          gridTemplateColumns: '260px minmax(0, 1fr) 300px',
        }}
      >
        {/* Left: Match + Leaderboard/Stats */}
        <LeftSidebar />

        {/* Center: Commentary / Chat / Quiz */}
        <CenterColumn onSendChat={sendChat} />

        {/* Right: Game Panel */}
        <RightGamePanel />
      </div>

      {/* Bottom room bar */}
      <RoomBar room={displayRoom} fanCount={displayFanCount} />
    </div>
  );
}
