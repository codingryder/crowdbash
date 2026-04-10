import { useGameStore } from '../../store/gameStore';
import { useAuthStore } from '../../store/authStore';
import { useGame } from '../../hooks/useGame';
import type { Room } from '../../types';

const AV_COLORS = [
  { bg: 'rgba(45,214,122,0.12)', color: '#2dd67a' },
  { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
  { bg: 'rgba(139,92,246,0.12)', color: '#8b5cf6' },
  { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6' },
  { bg: 'rgba(240,82,82,0.12)', color: '#f05252' },
];

interface Props {
  room: Room;
}

export function RightGamePanel({ room }: Props) {
  const game = useGameStore((s) => s.game);
  const user = useAuthStore((s) => s.user);
  const setShowTeamBuilder = useGameStore((s) => s.setShowTeamBuilder);
  const editWindowOpen = useGameStore((s) => s.editWindowOpen);
  const { joinGame } = useGame(room.id);

  const hasJoined = !!game;
  const isLocked = game?.squad_locked || false;
  const selectedPlayers = game?.player_weightages.filter((pw) => pw.selected) || [];
  const hasSquad = selectedPlayers.length === 11;
  const matchStarted = game?.match_started || false;

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center">
        <div className="text-3xl mb-4">🎮</div>
        <div className="font-cabinet text-[15px] font-extrabold mb-2">Fantasy Game</div>
        <div className="text-[12px]" style={{ color: 'var(--mu)' }}>Sign in to play</div>
      </div>
    );
  }

  if (!hasJoined) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center">
        <div className="text-3xl mb-4">🎮</div>
        <div className="font-cabinet text-[15px] font-extrabold mb-2">Fantasy Game</div>
        <div className="text-[12px] mb-5" style={{ color: 'var(--mu)' }}>
          Pick 11 players, assign power, earn fantasy points
        </div>
        <button
          onClick={joinGame}
          className="font-cabinet text-[13px] font-extrabold border-none rounded-btn px-6 py-2.5 transition-all"
          style={{ background: 'var(--green)', color: '#071a0e' }}
        >
          Join game
        </button>
      </div>
    );
  }

  if (!hasSquad && !isLocked) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center">
        <div className="text-3xl mb-4">🏏</div>
        <div className="font-cabinet text-[15px] font-extrabold mb-2">Build your squad</div>
        <div className="text-[12px] mb-5" style={{ color: 'var(--mu)' }}>
          Select 11 players and distribute 33 power
        </div>
        <button
          onClick={() => setShowTeamBuilder(true)}
          className="font-cabinet text-[13px] font-extrabold border-none rounded-btn px-6 py-2.5 transition-all"
          style={{ background: 'var(--green)', color: '#071a0e' }}
        >
          Build your XI →
        </button>
      </div>
    );
  }

  // Squad ready / locked — show performance
  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--bg2)' }}>
      {/* Header */}
      <div className="px-4 pt-4 pb-3 shrink-0" style={{ borderBottom: '1px solid var(--b1)' }}>
        <div className="font-cabinet text-[10px] font-bold tracking-[2px] mb-3" style={{ color: 'var(--mu)' }}>
          YOUR PERFORMANCE
        </div>
        <div className="flex items-baseline gap-1.5 mb-3">
          <div className="font-cabinet text-[34px] font-black" style={{ color: 'var(--green)', letterSpacing: '-1px' }}>
            {game?.total_points || 0}
          </div>
          <div className="text-[12px]" style={{ color: 'var(--mu)' }}>points</div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-[11px] font-semibold rounded-full px-2.5 py-1" style={{ background: 'var(--surface2)', border: '1px solid var(--b1)', color: 'var(--tx2)' }}>
            {isLocked ? '🔒 Locked' : '✅ Ready'}
          </div>
          {!matchStarted && (
            <button
              onClick={() => setShowTeamBuilder(true)}
              className="text-[11px] font-semibold rounded-full px-2.5 py-1 border-none transition-all"
              style={{ background: 'rgba(45,214,122,0.08)', border: '1px solid rgba(45,214,122,0.25)', color: 'var(--green)' }}
            >
              ✏️ Edit
            </button>
          )}
        </div>
      </div>

      {/* Edit window */}
      {matchStarted && editWindowOpen && (
        <div className="px-4 py-2.5 text-center shrink-0" style={{ background: 'rgba(139,92,246,0.08)', borderBottom: '1px solid rgba(139,92,246,0.25)' }}>
          <div className="font-cabinet text-[12px] font-bold" style={{ color: 'var(--purple)' }}>
            🔄 Power reshuffle window open
          </div>
          <button
            onClick={() => setShowTeamBuilder(true)}
            className="mt-1 font-cabinet text-[11px] font-bold border-none rounded-btn px-4 py-1.5 transition-all"
            style={{ background: 'var(--purple)', color: '#fff' }}
          >
            Reshuffle power ↗
          </button>
        </div>
      )}

      {/* Squad list */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="font-cabinet text-[10px] font-bold tracking-[2px] mb-2.5" style={{ color: 'var(--mu)' }}>
          YOUR SQUAD
        </div>
        {selectedPlayers.map((pw, i) => {
          const avStyle = AV_COLORS[i % AV_COLORS.length];
          return (
            <div
              key={pw.player_id}
              className="flex items-center gap-2 rounded-btn px-2.5 py-2 mb-1.5"
              style={{ background: 'var(--surface)', border: '1px solid var(--b1)' }}
            >
              <div
                className="w-7 h-7 rounded-[7px] flex items-center justify-center font-cabinet text-[8px] font-bold shrink-0"
                style={{ background: avStyle.bg, color: avStyle.color }}
              >
                {pw.player_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 text-[12px] font-medium truncate">{pw.player_name.split(' ').pop()}</div>
              <div className="font-cabinet text-[13px] font-extrabold shrink-0" style={{ color: 'var(--amber)' }}>
                {pw.weightage}x
              </div>
              <div className="text-[11px] min-w-[40px] text-right shrink-0" style={{ color: pw.points_earned > 0 ? 'var(--green)' : 'var(--mu)' }}>
                {pw.points_earned > 0 ? `${pw.points_earned}pts` : '—'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
