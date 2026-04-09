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

// Demo room data for when backend is offline
const DEMO_ROOMS: Record<string, { match_name: string; sport: Sport; format: string; venue: string; over: number; league: string }> = {
  'demo-1': { match_name: 'India vs Australia', sport: 'cricket', format: 'ODI', venue: 'MCG', over: 48.3, league: 'ICC World Cup' },
  'demo-2': { match_name: 'RCB vs MI', sport: 'cricket', format: 'T20', venue: 'Chinnaswamy', over: 15.2, league: 'IPL' },
  'demo-f1': { match_name: 'Arsenal vs Chelsea', sport: 'football', format: 'EPL', venue: 'Emirates Stadium', over: 0, league: 'Premier League' },
  'demo-f2': { match_name: 'Real Madrid vs Barcelona', sport: 'football', format: 'La Liga', venue: 'Santiago Bernab\u00e9u', over: 0, league: 'La Liga' },
};

export function CrowdbashRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const { room, loading } = useRoom(roomId);
  const { sendChat } = useWebSocket(roomId);
  useGame(roomId);
  const fanCount = useRoomStore((s) => s.fanCount);
  const setSport = useRoomStore((s) => s.setSport);

  // Determine sport from room data or demo
  const demoData = roomId ? DEMO_ROOMS[roomId] : undefined;
  const sport: Sport = room?.sport || demoData?.sport || 'cricket';

  // Set sport in store when room loads
  useEffect(() => {
    setSport(sport);
  }, [sport, setSport]);

  const displayRoom = room || {
    id: roomId || 'demo',
    match_id: 'demo',
    match_name: demoData?.match_name || 'Live Match',
    match_format: demoData?.format || 'Match',
    venue: demoData?.venue || '',
    status: 'live' as const,
    current_over: demoData?.over || 0,
    fan_count: 2841,
    sport,
    league: demoData?.league,
    match_progress: sport === 'football' ? { half: 2, minute: 67 } : { over: demoData?.over || 48.3 },
  };

  const displayFanCount = fanCount > 0 ? fanCount : 2841;

  if (loading && !room && !demoData) {
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
