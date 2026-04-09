import { useGameStore } from '../../store/gameStore';
import { useAuthStore } from '../../store/authStore';
import { useGame } from '../../hooks/useGame';
import { SquadSelection } from './SquadSelection';
import { WeightageAllocation } from './WeightageAllocation';
import type { Room } from '../../types';

interface RightGamePanelProps {
  room: Room;
}

export function RightGamePanel({ room }: RightGamePanelProps) {
  const game = useGameStore((s) => s.game);
  const user = useAuthStore((s) => s.user);
  const availableSquads = useGameStore((s) => s.availableSquads);
  const { joinGame, selectSquad, lockSquad, saveWeightages } = useGame(room.id);

  const hasSquads = Object.keys(availableSquads).length > 0;
  const hasJoined = !!game;
  const hasSelectedPlayers = game && game.player_weightages.filter((pw) => pw.selected).length === 11;
  const isLocked = game?.squad_locked || false;

  // Phase 0: Not signed in
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-4 text-center">
        <div className="text-2xl mb-3">🎮</div>
        <div className="font-syne text-sm font-bold mb-2" style={{ color: 'var(--tx)' }}>
          Weightage Game
        </div>
        <div className="text-[11px]" style={{ color: 'var(--mu)' }}>
          Sign in to play the Weightage Game
        </div>
      </div>
    );
  }

  // Phase 1: Not joined yet
  if (!hasJoined) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-4 text-center">
        <div className="text-2xl mb-3">🎮</div>
        <div className="font-syne text-sm font-bold mb-2" style={{ color: 'var(--tx)' }}>
          Weightage Game
        </div>
        <div className="text-[12px] mb-1" style={{ color: 'var(--tx)' }}>
          {room.match_name}
        </div>
        <div className="text-[11px] mb-4" style={{ color: 'var(--mu)' }}>
          {hasSquads
            ? 'Pick 11 players, allocate 50 weightage points, and earn fantasy points!'
            : 'Squads will be added before the match. Join to get notified.'}
        </div>
        <button
          onClick={joinGame}
          className="px-6 py-2.5 rounded-lg text-[13px] font-bold cursor-pointer font-syne border-none"
          style={{ background: 'var(--gold)', color: '#09090F' }}
        >
          Join Game
        </button>
      </div>
    );
  }

  // Phase 2: Joined but squad not selected yet
  if (!hasSelectedPlayers && !isLocked) {
    if (!hasSquads) {
      return (
        <div className="flex flex-col items-center justify-center h-full px-4 text-center">
          <div className="text-2xl mb-3">⏳</div>
          <div className="font-syne text-sm font-bold mb-2" style={{ color: 'var(--tx)' }}>
            Waiting for squads
          </div>
          <div className="text-[11px]" style={{ color: 'var(--mu)' }}>
            Squads will be announced before the match starts. You'll be able to pick your 11 players then.
          </div>
        </div>
      );
    }

    return <SquadSelection onConfirm={selectSquad} />;
  }

  // Phase 3 & 4: Squad selected → allocation / locked
  return (
    <WeightageAllocation
      onSave={saveWeightages}
      onLock={lockSquad}
      isLocked={isLocked}
    />
  );
}
