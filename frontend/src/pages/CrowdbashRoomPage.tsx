import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useRoom } from '../hooks/useRoom';
import { useWebSocket } from '../hooks/useWebSocket';
import { useGame } from '../hooks/useGame';
import { useAuth } from '../hooks/useAuth';
import { useRoomStore } from '../store/roomStore';
import { useGameStore } from '../store/gameStore';
import api from '../lib/api';
import type { ScoreData, Sport } from '../types';
import { RoomBar } from '../components/layout/RoomBar';
import { LeftSidebar } from '../components/room/LeftSidebar';
import { CenterColumn } from '../components/room/CenterColumn';
import { RightGamePanel } from '../components/game/RightGamePanel';
import { TeamBuilderModal } from '../components/game/TeamBuilderModal';
import { CompletedMatchView } from '../components/room/CompletedMatchView';
import { PaymentGate } from '../components/auth/PaymentGate';

export function CrowdbashRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const { room, loading } = useRoom(roomId);
  const { sendChat } = useWebSocket(roomId);
  const { selectSquad, lockSquad, saveWeightages } = useGame(roomId);
  const { user, openAuthModal } = useAuth();
  const fanCount = useRoomStore((s) => s.fanCount);
  const setSport = useRoomStore((s) => s.setSport);
  const showTeamBuilder = useGameStore((s) => s.showTeamBuilder);
  const setShowTeamBuilder = useGameStore((s) => s.setShowTeamBuilder);
  const [paymentDone, setPaymentDone] = useState(false);

  const sport: Sport = room?.sport || 'cricket';
  const setScore = useRoomStore((s) => s.setScore);

  useEffect(() => {
    setSport(sport);
  }, [sport, setSport]);

  // Fetch score immediately on page load (don't wait for WebSocket poll)
  useEffect(() => {
    if (!roomId || !room || room.status !== 'live') return;

    async function fetchInitialScore() {
      try {
        const { data } = await api.get(`/api/rooms/scorecard/${roomId}`);
        if (data.scorecard) {
          setScore(data.scorecard as ScoreData);
        }
      } catch {
        // Score not available yet
      }
    }
    fetchInitialScore();

    // Also poll every 30 seconds as backup to WebSocket
    const interval = setInterval(fetchInitialScore, 15000); // Poll every 15 seconds
    return () => clearInterval(interval);
  }, [roomId, room?.status]);

  // Check if user has already paid
  useEffect(() => {
    if (user?.payment_status === 'paid') {
      setPaymentDone(true);
    }
  }, [user]);

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
          <Link to="/" className="text-xs no-underline" style={{ color: 'var(--gold)' }}>Back to rooms</Link>
        </div>
      </div>
    );
  }

  // Completed matches — show detail view (no auth/payment needed)
  if (room.status === 'completed') {
    return <CompletedMatchView room={room} />;
  }

  // Live/upcoming rooms — require sign in
  if (!user) {
    return (
      <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 52px)' }}>
        <div className="text-center max-w-md mx-4">
          <div className="text-3xl mb-4">🏟️</div>
          <div className="font-syne text-lg font-bold mb-2" style={{ color: 'var(--tx)' }}>
            {room.match_name}
          </div>
          <div className="text-[13px] mb-6" style={{ color: 'var(--mu)' }}>
            Sign in to join this room, play the Weightage Game, and chat with fans.
          </div>
          <button
            onClick={openAuthModal}
            className="px-8 py-3 rounded-lg text-[14px] font-bold cursor-pointer font-syne border-none"
            style={{ background: 'var(--gold)', color: '#09090F' }}
          >
            Sign in to Join
          </button>
        </div>
      </div>
    );
  }

  // Require payment
  if (!paymentDone) {
    return (
      <PaymentGate
        roomId={room.id}
        roomName={room.match_name}
        onSuccess={() => setPaymentDone(true)}
      />
    );
  }

  // Full room experience
  return (
    <>
      {showTeamBuilder && (
        <TeamBuilderModal
          roomName={room.match_name}
          onSelectSquad={selectSquad}
          onSaveWeightages={saveWeightages}
          onLockSquad={lockSquad}
          onClose={() => setShowTeamBuilder(false)}
        />
      )}
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
    </>
  );
}
