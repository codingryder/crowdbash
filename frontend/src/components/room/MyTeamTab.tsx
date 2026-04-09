import { useGameStore } from '../../store/gameStore';

const AVATAR_COLORS = [
  { bg: 'rgba(74,158,255,0.15)', color: 'var(--blue)' },
  { bg: 'rgba(244,185,64,0.12)', color: 'var(--gold)' },
  { bg: 'rgba(61,214,140,0.1)', color: 'var(--green)' },
  { bg: 'rgba(139,111,255,0.12)', color: 'var(--purple)' },
  { bg: 'rgba(240,90,90,0.1)', color: 'var(--red)' },
];

const ROLE_BADGES: Record<string, { label: string; color: string }> = {
  batsman: { label: 'BAT', color: 'var(--blue)' },
  bowler: { label: 'BOWL', color: 'var(--green)' },
  'all-rounder': { label: 'AR', color: 'var(--purple)' },
  'wicket-keeper': { label: 'WK', color: 'var(--gold)' },
};

interface MyTeamTabProps {
  roomId: string;
}

export function MyTeamTab({ roomId: _roomId }: MyTeamTabProps) {
  const game = useGameStore((s) => s.game);

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
          <div className="font-syne text-[15px] font-bold" style={{ color: 'var(--tx)' }}>
            My Fantasy XI
          </div>
          <div className="text-[11px]" style={{ color: 'var(--mu)' }}>
            {selectedPlayers.length} players · Budget: {game.total_budget} pts
          </div>
        </div>
        <div className="text-right">
          <div className="font-syne text-2xl font-extrabold" style={{ color: 'var(--gold)' }}>
            {totalPoints.toLocaleString()}
          </div>
          <div className="text-[10px]" style={{ color: 'var(--mu)' }}>total points</div>
        </div>
      </div>

      {/* Player list */}
      <div className="space-y-2">
        {sortedPlayers.map((player, i) => {
          const avStyle = AVATAR_COLORS[i % AVATAR_COLORS.length];
          const initials = player.player_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
          const badge = ROLE_BADGES[(player.player_role || '').toLowerCase()];
          const breakdown = player.scoring_breakdown || {};
          const fantasyPts = (breakdown.fantasy_points as number) || 0;

          return (
            <div
              key={player.player_id}
              className="rounded-xl p-3"
              style={{
                background: 'var(--s1)',
                border: player.points_earned > 0 ? '0.5px solid rgba(61,214,140,0.3)' : '0.5px solid var(--b1)',
              }}
            >
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                  style={{ background: avStyle.bg, color: avStyle.color }}
                >
                  {initials}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium" style={{ color: 'var(--tx)' }}>{player.player_name}</span>
                    {badge && (
                      <span className="text-[8px] font-semibold px-1.5 py-px rounded" style={{ background: 'var(--s2)', color: badge.color }}>
                        {badge.label}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px]" style={{ color: 'var(--mu)' }}>{player.team}</div>
                </div>

                {/* Weightage */}
                <div className="text-center shrink-0 mr-2">
                  <div className="font-syne text-[14px] font-bold" style={{ color: 'var(--gold)' }}>
                    {player.weightage}
                  </div>
                  <div className="text-[8px]" style={{ color: 'var(--mu)' }}>wt</div>
                </div>

                {/* Points */}
                <div className="text-right shrink-0 min-w-[60px]">
                  <div className="font-syne text-[14px] font-bold" style={{ color: player.points_earned > 0 ? 'var(--green)' : 'var(--dm)' }}>
                    {player.points_earned > 0 ? `+${player.points_earned}` : '0'}
                  </div>
                  <div className="text-[8px]" style={{ color: 'var(--mu)' }}>pts</div>
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
