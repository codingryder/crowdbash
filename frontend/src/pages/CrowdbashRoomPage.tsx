import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useRoom } from '../hooks/useRoom';
import { useWebSocket } from '../hooks/useWebSocket';
import { useGame } from '../hooks/useGame';
import { useRoomStore } from '../store/roomStore';
import { RoomBar } from '../components/layout/RoomBar';
import { LeftSidebar } from '../components/room/LeftSidebar';
import { CenterColumn } from '../components/room/CenterColumn';
import { RightGamePanel } from '../components/game/RightGamePanel';
import type { Sport } from '../types';

export function CrowdbashRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const { room, loading } = useRoom(roomId);
  const { sendChat } = useWebSocket(roomId);
  useGame(roomId);
  const fanCount = useRoomStore((s) => s.fanCount);
  const setSport = useRoomStore((s) => s.setSport);

  // Get sport from room data
  const sport: Sport = room?.sport || 'cricket';

  useEffect(() => {
    setSport(sport);
  }, [sport, setSport]);

  // Build display room from real data with fallbacks
  const displayRoom = room || {
    id: roomId || 'unknown',
    match_id: '',
    match_name: 'Loading...',
    match_format: '',
    venue: '',
    status: 'live' as const,
    current_over: 0,
    fan_count: 0,
    sport,
    match_progress: {},
  };

  const displayFanCount = fanCount > 0 ? fanCount : (room?.fan_count || 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 52px)' }}>
        <div className="font-syne" style={{ color: 'var(--mu)' }}>Loading room...</div>
      </div>
    );
  }

  if (!room && !roomId?.startsWith('demo')) {
    return (
      <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 52px)' }}>
        <div className="text-center">
          <div className="font-syne text-lg mb-2" style={{ color: 'var(--mu)' }}>Room not found</div>
          <a href="/" className="text-xs" style={{ color: 'var(--gold)' }}>Back to rooms</a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 52px)' }}>
      <div
        className="flex-1 grid overflow-hidden"
        style={{ gridTemplateColumns: '260px minmax(0, 1fr) 300px' }}
      >
        <LeftSidebar />
        <CenterColumn onSendChat={sendChat} />
        <RightGamePanel />
      </div>
      <RoomBar room={displayRoom} fanCount={displayFanCount} />
    </div>
  );
}
