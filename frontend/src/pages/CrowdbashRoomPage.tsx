import { useParams } from 'react-router-dom';
import { useRoom } from '../hooks/useRoom';
import { useWebSocket } from '../hooks/useWebSocket';
import { useGame } from '../hooks/useGame';
import { useRoomStore } from '../store/roomStore';
import { RoomBar } from '../components/layout/RoomBar';
import { ScoreHeader } from '../components/room/ScoreHeader';
import { CommentaryFeed } from '../components/room/CommentaryFeed';
import { ChatPanel } from '../components/room/ChatPanel';
import { QuizPanel } from '../components/room/QuizPanel';
import { StatsPanel } from '../components/room/StatsPanel';
import { GamePanel } from '../components/game/GamePanel';

export function CrowdbashRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const { room, loading } = useRoom(roomId);
  const { sendChat } = useWebSocket(roomId);
  const { game, joinGame } = useGame(roomId);
  const fanCount = useRoomStore((s) => s.fanCount);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-white/30 font-syne">Loading room...</div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-white/30 font-syne">Room not found</div>
      </div>
    );
  }

  return (
    <div>
      <RoomBar room={room} fanCount={fanCount} />

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column — Score, Commentary, Chat */}
          <div className="lg:col-span-2 space-y-4">
            <ScoreHeader />
            <CommentaryFeed />
            <ChatPanel onSendChat={sendChat} />
            <QuizPanel />
          </div>

          {/* Right column — Game Panel + Leaderboard */}
          <div className="space-y-4">
            {!game && (
              <button
                onClick={joinGame}
                className="w-full py-3 bg-gold text-bg font-syne font-bold rounded-xl hover:bg-gold/90 transition"
              >
                Join Weightage Game
              </button>
            )}
            <GamePanel roomId={roomId!} />
            <StatsPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
