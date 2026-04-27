import { useGameStore } from '../../store/gameStore';
import { PlayerAvatar } from '../ui/PlayerAvatar';
import { usePlayingXi } from '../../hooks/usePlayingXi';

const ROLE_BADGES: Record<string, { label: string; color: string }> = {
  batsman: { label: 'BAT', color: 'var(--blue)' },
  bowler: { label: 'BOWL', color: 'var(--green)' },
  'all-rounder': { label: 'AR', color: 'var(--purple)' },
  'wicket-keeper': { label: 'WK', color: 'var(--gold)' },
};

interface MyTeamTabProps {
  roomId: string;
  matchStarted?: boolean;
}

export function MyTeamTab({ roomId: _roomId, matchStarted = false }: MyTeamTabProps) {
  const game = useGameStore((s) => s.game);
  const { announced, isInXi } = usePlayingXi();

  // Match has already started → user is a spectator if they either
  // never joined a game (backend blocks late joins) or joined but never
  // locked their squad. Same UX in both cases: chat + watch, no scoring.
  if (matchStarted && (!game || !game.squad_locked)) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
        <div className="text-3xl mb-3">👀</div>
        <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 16, fontWeight: 900, marginBottom: 6, color: 'var(--tx)' }}>
          You're a spectator
        </div>
        <div className="text-[12px] mb-1" style={{ color: 'var(--mu)', maxWidth: 320, lineHeight: 1.6 }}>
          The match has already started, so you can't build a team for this room. You can still chat with everyone and follow the live score.
        </div>
        <div className="text-[11px] mt-3" style={{ color: 'var(--mu)' }}>Join the next room before first ball to play!</div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
        <div className="text-2xl mb-3">🎮</div>
        <div className="text-[13px] font-medium mb-1" style={{ color: 'var(--tx)' }}>No team yet</div>
        <div className="text-[11px]" style={{ color: 'var(--mu)' }}>Join the game and build your XI to see your team here</div>
      </div>
    );
  }

  const selectedPlayers = game.player_weightages.filter((pw) => pw.selected);
  const totalPoints = game.total_points;

  // Sort by points earned descending
  const sortedPlayers = [...selectedPlayers].sort((a, b) => b.points_earned - a.points_earned);

  return (
    <div style={{ padding: '16px 20px' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 18, fontWeight: 900 }}>
            My Fantasy XI
          </div>
          <div className="text-[12px]" style={{ color: 'var(--muted)' }}>
            {selectedPlayers.length} players · Budget: {game.total_budget} pts
          </div>
        </div>
        <div className="text-right">
          <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 36, fontWeight: 900, color: 'var(--green)', letterSpacing: '-1px' }}>
            {totalPoints.toLocaleString()}
          </div>
          <div className="text-[11px]" style={{ color: 'var(--muted)' }}>total points</div>
        </div>
      </div>

      {/* Player list */}
      <div className="space-y-2">
        {sortedPlayers.map((player, i) => {
          const badge = ROLE_BADGES[(player.player_role || '').toLowerCase()];
          const breakdown = player.scoring_breakdown || {};
          const fantasyPts = (breakdown.fantasy_points as number) || 0;
          const isBenched = announced && !isInXi(player.player_name);

          return (
            <div
              key={player.player_id}
              className="rounded-xl p-3"
              style={{
                background: 'var(--s1)',
                border: isBenched
                  ? '0.5px solid rgba(240,90,90,0.25)'
                  : player.points_earned > 0
                    ? '0.5px solid rgba(61,214,140,0.3)'
                    : '0.5px solid var(--b1)',
                borderLeft: isBenched ? '3px solid var(--red)' : undefined,
              }}
            >
              <div className="flex items-center gap-3">
                <PlayerAvatar
                  name={player.player_name}
                  imageUrl={player.image_url}
                  seed={String.fromCharCode(65 + (i % 5))}
                  size={36}
                  radius={18}
                  fontSize={11}
                />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[15px] font-semibold">{player.player_name}</span>
                    {badge && (
                      <span className="text-[9px] font-semibold px-1.5 py-px rounded" style={{ background: 'var(--surface)', color: badge.color }}>
                        {badge.label}
                      </span>
                    )}
                    {isBenched && (
                      <span
                        className="text-[9px] font-bold px-1.5 py-px rounded"
                        style={{ background: 'rgba(240,90,90,0.12)', color: 'var(--red)' }}
                      >
                        NOT IN XI
                      </span>
                    )}
                  </div>
                  <div className="text-[11px]" style={{ color: 'var(--muted)' }}>{player.team}</div>
                </div>

                {/* Weightage */}
                <div className="text-center shrink-0 mr-3">
                  <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 18, fontWeight: 900, color: 'var(--amber)' }}>
                    {player.weightage}x
                  </div>
                  <div className="text-[9px]" style={{ color: 'var(--muted)' }}>power</div>
                </div>

                {/* Points */}
                <div className="text-right shrink-0 min-w-[65px]">
                  <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 18, fontWeight: 900, color: player.points_earned > 0 ? 'var(--green)' : 'var(--muted)' }}>
                    {player.points_earned > 0 ? `+${player.points_earned}` : '0'}
                  </div>
                  <div className="text-[9px]" style={{ color: 'var(--muted)' }}>pts</div>
                </div>
              </div>

              {/* Scoring breakdown (if has points) */}
              {fantasyPts > 0 && (
                <div className="flex flex-wrap gap-2 mt-2 pt-2" style={{ borderTop: '0.5px solid var(--b1)' }}>
                  {breakdown.runs != null && (breakdown.runs as number) > 0 && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'var(--s2)', color: 'var(--blue)' }}>
                      {breakdown.runs as number} runs
                    </span>
                  )}
                  {breakdown.wickets != null && (breakdown.wickets as number) > 0 && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'var(--s2)', color: 'var(--green)' }}>
                      {breakdown.wickets as number}w
                    </span>
                  )}
                  {breakdown.catches != null && (breakdown.catches as number) > 0 && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'var(--s2)', color: 'var(--purple)' }}>
                      {breakdown.catches as number} catch
                    </span>
                  )}
                  <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'var(--s2)', color: 'var(--mu)' }}>
                    fantasy: {fantasyPts} × {player.weightage} = {player.points_earned}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
