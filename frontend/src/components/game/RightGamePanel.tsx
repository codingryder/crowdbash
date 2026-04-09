import { useGameStore } from '../../store/gameStore';
import { useAuthStore } from '../../store/authStore';
import { SHOP_ITEMS } from '../../types';
import type { Room } from '../../types';

const AVATAR_STYLES = [
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
  const editWindowOpen = useGameStore((s) => s.editWindowOpen);
  const remainingBudget = useGameStore((s) => s.remainingBudget);
  const user = useAuthStore((s) => s.user);

  const budget = game ? remainingBudget : 10;
  const totalBudget = 10;
  const parts = room.match_name.split(' vs ');
  const team1 = parts[0]?.trim() || 'Team 1';
  const team2 = parts[1]?.trim() || 'Team 2';

  // Format edit window info based on sport
  const editWindowText = room.sport === 'football'
    ? 'Edit window: Opens at halftime'
    : `Edit window: Opens every 5 overs`;

  return (
    <div className="flex flex-col overflow-hidden">
      {/* Game Header */}
      <div style={{ padding: '14px 16px 12px', borderBottom: '0.5px solid var(--b1)' }}>
        <div
          className="text-[9px] uppercase tracking-[1px] mb-2.5"
          style={{ color: 'var(--mu)' }}
        >
          Weightage game &middot; {room.sport === 'football' ? '\u26BD' : '\uD83C\uDFCF'} {room.league || room.match_format}
        </div>
        <div className="flex items-center justify-between mb-2.5">
          <div className="text-center">
            <div className="text-[11px] font-medium" style={{ color: 'var(--blue)' }}>{team1}</div>
            <div className="font-syne text-[22px] font-extrabold" style={{ color: 'var(--gold)' }}>
              {game ? game.total_points.toLocaleString() : '\u2014'}
            </div>
          </div>
          <div className="text-xs" style={{ color: 'var(--dm)' }}>vs</div>
          <div className="text-center">
            <div className="text-[11px] font-medium" style={{ color: 'var(--red)' }}>{team2}</div>
            <div className="font-syne text-[22px] font-extrabold" style={{ color: 'var(--mu)' }}>
              \u2014
            </div>
          </div>
        </div>
        <div className="flex gap-3 justify-center">
          {[
            { label: 'Status', value: room.status === 'live' ? 'Live' : room.status, color: room.status === 'live' ? 'var(--green)' : 'var(--tx)' },
            { label: 'Sport', value: room.sport, color: 'var(--tx)' },
            { label: 'Format', value: room.match_format || '\u2014', color: 'var(--tx)' },
          ].map((item) => (
            <div key={item.label} className="text-center">
              <div className="text-[9px] uppercase tracking-[0.4px]" style={{ color: 'var(--mu)' }}>
                {item.label}
              </div>
              <div className="text-xs font-medium mt-0.5 capitalize" style={{ color: item.color }}>
                {item.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Budget bar */}
      <div
        className="flex items-center justify-between"
        style={{
          padding: '10px 16px',
          borderBottom: '0.5px solid var(--b1)',
          background: 'rgba(244,185,64,0.05)',
        }}
      >
        <div>
          <div className="text-[11px]" style={{ color: 'var(--gold)' }}>Weightage budget</div>
          <div className="text-[10px] mt-0.5" style={{ color: 'rgba(244,185,64,0.5)' }}>
            {budget} of {totalBudget} unassigned
          </div>
        </div>
        <div className="text-right">
          <div className="font-syne text-[17px] font-extrabold" style={{ color: 'var(--gold)' }}>
            {budget}
          </div>
          <div className="text-[10px]" style={{ color: 'rgba(244,185,64,0.5)' }}>remaining</div>
        </div>
      </div>

      {/* Lock bar */}
      <div
        className="flex items-center justify-between"
        style={{ padding: '8px 16px', borderBottom: '0.5px solid var(--b1)' }}
      >
        <div className="text-[11px]" style={{ color: 'var(--mu)' }}>
          {editWindowText}
        </div>
        <div
          className="text-[10px] px-2.5 py-0.5 rounded-[20px]"
          style={{
            background: editWindowOpen ? 'rgba(244,185,64,0.08)' : 'rgba(61,214,140,0.08)',
            color: editWindowOpen ? 'var(--gold)' : 'var(--green)',
          }}
        >
          {editWindowOpen ? 'Open' : 'Locked'}
        </div>
      </div>

      {/* Player cards or sign in prompt */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '10px 12px' }}>
        {!user && !game && (
          <div className="text-center py-8">
            <div className="text-sm mb-2" style={{ color: 'var(--mu)' }}>
              Sign in to play the Weightage Game
            </div>
            <div className="text-xs" style={{ color: 'var(--dm)' }}>
              Distribute weightage points across players and earn points based on their performance
            </div>
          </div>
        )}

        {user && !game && (
          <div className="text-center py-8">
            <div className="text-sm mb-3" style={{ color: 'var(--mu)' }}>
              Join this room to start playing
            </div>
            <div className="text-xs" style={{ color: 'var(--dm)' }}>
              Players will appear here once the match goes live and you join the game
            </div>
          </div>
        )}

        {game && (
          <>
            <div
              className="text-[9px] uppercase tracking-[1px] mb-2 py-0.5"
              style={{ color: 'var(--mu)' }}
            >
              Your squad
            </div>

            {game.player_weightages.map((player, i) => (
              <div
                key={player.player_id}
                className="flex items-center gap-2.5 rounded-[10px] mb-[7px]"
                style={{
                  background: 'var(--s1)',
                  border: '0.5px solid var(--b1)',
                  padding: '10px 12px',
                }}
              >
                <div
                  className="w-[34px] h-[34px] rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                  style={{
                    background: AVATAR_STYLES[i % AVATAR_STYLES.length].bg,
                    color: AVATAR_STYLES[i % AVATAR_STYLES.length].color,
                  }}
                >
                  {player.player_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium" style={{ color: 'var(--tx)' }}>
                    {player.player_name}
                  </div>
                  <div className="text-[10px] mt-0.5" style={{ color: 'var(--mu)' }}>
                    {player.player_role || player.team}
                  </div>
                  {player.points_earned > 0 && (
                    <div className="text-[10px] mt-0.5" style={{ color: 'var(--green)' }}>
                      +{player.points_earned} pts
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-[13px] font-medium cursor-pointer transition-all"
                    style={{ border: '0.5px solid var(--b2)', background: 'var(--s2)', color: 'var(--tx)' }}
                  >
                    &minus;
                  </button>
                  <div
                    className="font-syne text-[13px] font-bold min-w-[16px] text-center"
                    style={{ color: 'var(--gold)' }}
                  >
                    {player.weightage}
                  </div>
                  <button
                    className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-[13px] font-medium cursor-pointer transition-all"
                    style={{ border: '0.5px solid var(--b2)', background: 'var(--s2)', color: 'var(--tx)' }}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Shop */}
      <div style={{ padding: '10px 12px', borderTop: '0.5px solid var(--b1)' }}>
        <div
          className="text-[9px] uppercase tracking-[1px] mb-2"
          style={{ color: 'var(--mu)' }}
        >
          Buy extra weightage
        </div>
        <div className="flex gap-2">
          {SHOP_ITEMS.map((item) => (
            <div
              key={item.id}
              className="flex-1 rounded-[10px] p-2.5"
              style={{ background: 'var(--s1)', border: '0.5px solid var(--b1)' }}
            >
              <div className="text-[11px] font-medium mb-0.5">{item.label}</div>
              <div className="text-[13px] font-bold mb-1.5" style={{ color: 'var(--gold)' }}>
                \u20B9{item.price_inr}
              </div>
              <div className="text-[10px] leading-[1.4] mb-2" style={{ color: 'var(--mu)' }}>
                {item.description}
              </div>
              <button
                className="w-full py-[5px] rounded-md text-[11px] font-semibold cursor-pointer font-syne"
                style={{
                  background: 'rgba(244,185,64,0.1)',
                  border: '0.5px solid rgba(244,185,64,0.25)',
                  color: 'var(--gold)',
                }}
              >
                Buy now
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
