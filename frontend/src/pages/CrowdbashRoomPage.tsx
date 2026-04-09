import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useRoom } from '../hooks/useRoom';
import { useWebSocket } from '../hooks/useWebSocket';
import { useGame } from '../hooks/useGame';
import { useRoomStore } from '../store/roomStore';
import { RoomBar } from '../components/layout/RoomBar';
import { LeftSidebar } from '../components/room/LeftSidebar';
import { CenterColumn } from '../components/room/CenterColumn';
import { RightGamePanel } from '../components/game/RightGamePanel';
import { CompletedMatchView } from '../components/room/CompletedMatchView';
import type { Sport } from '../types';

export function CrowdbashRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const { room, loading } = useRoom(roomId);
  const { sendChat } = useWebSocket(roomId);
  useGame(roomId);
  const fanCount = useRoomStore((s) => s.fanCount);
  const setSport = useRoomStore((s) => s.setSport);

  const sport: Sport = room?.sport || 'cricket';

  useEffect(() => {
    setSport(sport);
  }, [sport, setSport]);

  const displayFanCount = fanCount > 0 ? fanCount : (room?.fan_count || 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 52px)' }}>
        <div className="font-syne" style={{ color: 'var(--mu)' }}>Loading room...</div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 52px)' }}>
        <div className="text-center">
          <div className="font-syne text-lg mb-2" style={{ color: 'var(--mu)' }}>Room not found</div>
          <Link to="/" className="text-xs" style={{ color: 'var(--gold)' }}>Back to rooms</Link>
        </div>
      </div>
    );
  }

  // Completed matches get a detail view instead of the live 3-column layout
  if (room.status === 'completed') {
    return <CompletedMatchView room={room} />;
  }

  // Live and upcoming matches get the full fan room experience
  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 52px)' }}>
      <div
        className="flex-1 grid overflow-hidden"
        style={{ gridTemplateColumns: '260px minmax(0, 1fr) 300px' }}
      >
        <LeftSidebar room={room} />
        <CenterColumn onSendChat={sendChat} room={room} />
        <RightGamePanel room={room} />
      </div>
      <RoomBar room={room} fanCount={displayFanCount} />
    </div>
  );
}
