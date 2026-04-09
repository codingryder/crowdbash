import { useGameStore } from '../../store/gameStore';
import { useAuthStore } from '../../store/authStore';
import { useGame } from '../../hooks/useGame';
import type { Room } from '../../types';

const AVATAR_COLORS = [
  { bg: 'rgba(74,158,255,0.15)', color: 'var(--blue)' },
  { bg: 'rgba(244,185,64,0.12)', color: 'var(--gold)' },
  { bg: 'rgba(61,214,140,0.1)', color: 'var(--green)' },
  { bg: 'rgba(139,111,255,0.12)', color: 'var(--purple)' },
  { bg: 'rgba(240,90,90,0.1)', color: 'var(--red)' },
];

interface RightGamePanelProps {
  room: Room;
}

export function RightGamePanel({ room }: RightGamePanelProps) {
  const game = useGameStore((s) => s.game);
  const user = useAuthStore((s) => s.user);
  const setShowTeamBuilder = useGameStore((s) => s.setShowTeamBuilder);
  const editWindowOpen = useGameStore((s) => s.editWindowOpen);
  const { joinGame } = useGame(room.id);

  const hasJoined = !!game;
  const isLocked = game?.squad_locked || false;
  const selectedPlayers = game?.player_weightages.filter((pw) => pw.selected) || [];
  const hasSquad = selectedPlayers.length === 11;

  // Not signed in
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-4 text-center">
        <div className="text-2xl mb-3">🎮</div>
        <div className="font-syne text-sm font-bold mb-2" style={{ color: 'var(--tx)' }}>Weightage Game</div>
        <div className="text-[11px]" style={{ color: 'var(--mu)' }}>Sign in to play</div>
      </div>
    );
  }

  // Not joined
  if (!hasJoined) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-4 text-center">
        <div className="text-2xl mb-3">🎮</div>
        <div className="font-syne text-sm font-bold mb-2" style={{ color: 'var(--tx)' }}>Weightage Game</div>
        <div className="text-[11px] mb-4" style={{ color: 'var(--mu)' }}>
          Pick 11 players, allocate 50 points, and earn fantasy points!
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

  // Joined but no squad yet → show "Build Your Team" button
  if (!hasSquad && !isLocked) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-4 text-center">
        <div className="text-2xl mb-3">🏏</div>
        <div className="font-syne text-sm font-bold mb-2" style={{ color: 'var(--tx)' }}>
          Build Your Team
        </div>
        <div className="text-[11px] mb-4" style={{ color: 'var(--mu)' }}>
          Select 11 players from both squads and allocate your 50 weightage points
        </div>
        <button
          onClick={() => setShowTeamBuilder(true)}
          className="px-6 py-2.5 rounded-lg text-[13px] font-bold cursor-pointer font-syne border-none"
          style={{ background: 'var(--gold)', color: '#09090F' }}
        >
          Build Your XI →
        </button>
      </div>
    );
  }

  // Squad selected but not locked → show allocation prompt
  if (hasSquad && !isLocked) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-4 py-3" style={{ borderBottom: '0.5px solid var(--b1)' }}>
          <div className="font-syne text-sm font-bold" style={{ color: 'var(--gold)' }}>Your XI Selected</div>
          <div className="text-[11px]" style={{ color: 'var(--mu)' }}>Allocate points and lock your team</div>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2">
          {selectedPlayers.map((pw, i) => (
            <CompactPlayerRow key={pw.player_id} player={pw} index={i} />
          ))}
        </div>
        <div className="px-3 py-3" style={{ borderTop: '0.5px solid var(--b1)' }}>
          <button
            onClick={() => setShowTeamBuilder(true)}
            className="w-full py-2.5 rounded-lg text-[13px] font-bold cursor-pointer font-syne border-none"
            style={{ background: 'var(--gold)', color: '#09090F' }}
          >
            Allocate Points & Lock →
          </button>
        </div>
      </div>
    );
  }

  // Locked or match started → show game view
  const matchStarted = game?.match_started || false;
  const canModifyTeam = !matchStarted; // Can modify team + weightages before match

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3" style={{ borderBottom: '0.5px solid var(--b1)', background: matchStarted ? 'rgba(61,214,140,0.05)' : 'rgba(244,185,64,0.05)' }}>
        <div className="flex items-center gap-2">
          <span className="text-sm">{matchStarted ? '🔒' : '✅'}</span>
          <div className="flex-1">
            <div className="font-syne text-sm font-bold" style={{ color: matchStarted ? 'var(--green)' : 'var(--gold)' }}>
              {matchStarted ? 'Squad Locked' : 'Team Ready'}
            </div>
            <div className="text-[10px]" style={{ color: 'var(--mu)' }}>
              {matchStarted
                ? `${game?.total_points || 0} total points`
                : 'You can modify your team until the match starts'}
            </div>
          </div>
        </div>
      </div>

      {/* Pre-match: Modify team button */}
      {canModifyTeam && (
        <div className="px-4 py-2" style={{ borderBottom: '0.5px solid var(--b1)' }}>
          <button
            onClick={() => setShowTeamBuilder(true)}
            className="w-full py-2 rounded-lg text-[12px] font-semibold cursor-pointer font-syne border-none"
            style={{ background: 'var(--s2)', color: 'var(--gold)', border: '0.5px solid rgba(244,185,64,0.3)' }}
          >
            ✏️ Modify Team & Weightages
          </button>
        </div>
      )}

      {/* During match: edit window indicator */}
      {matchStarted && editWindowOpen && (
        <div className="px-4 py-2 text-center" style={{ background: 'rgba(244,185,64,0.08)', borderBottom: '0.5px solid var(--b1)' }}>
          <div className="text-[11px] font-semibold" style={{ color: 'var(--gold)' }}>
            Edit window open! Shuffle your weightages (2 min)
          </div>
          <button
            onClick={() => setShowTeamBuilder(true)}
            className="mt-1 px-4 py-1 rounded text-[11px] font-semibold cursor-pointer border-none"
            style={{ background: 'var(--gold)', color: '#09090F' }}
          >
            Shuffle Weightages
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-3 py-2">
        <div className="text-[9px] uppercase tracking-[1px] mb-2" style={{ color: 'var(--mu)' }}>
          Your XI
        </div>
        {selectedPlayers.map((pw, i) => (
          <CompactPlayerRow key={pw.player_id} player={pw} index={i} showPoints />
        ))}
      </div>
    </div>
  );
}

function CompactPlayerRow({
  player,
  index,
  showPoints,
}: {
  player: { player_id: string; player_name: string; team: string; weightage: number; points_earned: number; player_role?: string };
  index: number;
  showPoints?: boolean;
}) {
  const avStyle = AVATAR_COLORS[index % AVATAR_COLORS.length];
  const initials = player.player_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div
      className="flex items-center gap-2 rounded-lg mb-1 px-2.5 py-1.5"
      style={{ background: 'var(--s1)', border: '0.5px solid var(--b1)' }}
    >
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
        style={{ background: avStyle.bg, color: avStyle.color }}
      >
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-medium truncate" style={{ color: 'var(--tx)' }}>
          {player.player_name}
        </div>
      </div>
      <div className="font-syne text-[12px] font-bold" style={{ color: 'var(--gold)' }}>
        {player.weightage}
      </div>
      {showPoints && player.points_earned > 0 && (
        <div className="text-[10px]" style={{ color: 'var(--green)' }}>
          +{player.points_earned}
        </div>
      )}
    </div>
  );
}
