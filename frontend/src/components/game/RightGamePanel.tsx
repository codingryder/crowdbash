import { useGameStore } from '../../store/gameStore';
import { SHOP_ITEMS } from '../../types';

const AVATAR_STYLES = [
  { bg: 'rgba(74,158,255,0.15)', color: 'var(--blue)' },
  { bg: 'rgba(244,185,64,0.12)', color: 'var(--gold)' },
  { bg: 'rgba(61,214,140,0.1)', color: 'var(--green)' },
  { bg: 'rgba(139,111,255,0.12)', color: 'var(--purple)' },
  { bg: 'rgba(240,90,90,0.1)', color: 'var(--red)' },
];

// Sample players for mockup
const SAMPLE_PLAYERS = [
  { id: 'vk', initials: 'VK', name: 'V. Kohli', role: 'Batter \u00b7 IND', pts: 376, wt: 3 },
  { id: 'rs', initials: 'RS', name: 'R. Sharma', role: 'Batter \u00b7 IND', pts: 213, wt: 2 },
  { id: 'jb', initials: 'JB', name: 'J. Bumrah', role: 'Bowler \u00b7 IND', pts: 148, wt: 2 },
  { id: 'kl', initials: 'KL', name: 'KL Rahul', role: 'Batter \u00b7 IND', pts: 89, wt: 1 },
  { id: 'hp', initials: 'HH', name: 'H. Pandya', role: 'All-rounder \u00b7 IND', pts: 58, wt: 0 },
];

export function RightGamePanel() {
  const game = useGameStore((s) => s.game);
  const editWindowOpen = useGameStore((s) => s.editWindowOpen);
  const remainingBudget = useGameStore((s) => s.remainingBudget);

  // Use real data if available, otherwise sample
  const budget = game ? remainingBudget : 2;
  const totalBudget = 10;

  return (
    <div className="flex flex-col overflow-hidden">
      {/* Game Header — 1v1 mode */}
      <div style={{ padding: '14px 16px 12px', borderBottom: '0.5px solid var(--b1)' }}>
        <div
          className="text-[9px] uppercase tracking-[1px] mb-2.5"
          style={{ color: 'var(--mu)' }}
        >
          Weightage game &middot; 1v1 mode
        </div>
        <div className="flex items-center justify-between mb-2.5">
          <div className="text-center">
            <div className="text-[11px] font-medium" style={{ color: 'var(--blue)' }}>Team RK</div>
            <div className="font-syne text-[22px] font-extrabold" style={{ color: 'var(--gold)' }}>
              {game ? game.total_points.toLocaleString() : '1,284'}
            </div>
          </div>
          <div className="text-xs" style={{ color: 'var(--dm)' }}>vs</div>
          <div className="text-center">
            <div className="text-[11px] font-medium" style={{ color: 'var(--red)' }}>Team AR</div>
            <div className="font-syne text-[22px] font-extrabold" style={{ color: 'var(--mu)' }}>
              1,107
            </div>
          </div>
        </div>
        <div className="flex gap-3 justify-center">
          {[
            { label: 'Leading', value: '+177', color: 'var(--green)' },
            { label: 'Overs left', value: '1.3', color: 'var(--tx)' },
            { label: 'Next edit', value: 'Over 50', color: 'var(--tx)' },
          ].map((item) => (
            <div key={item.label} className="text-center">
              <div className="text-[9px] uppercase tracking-[0.4px]" style={{ color: 'var(--mu)' }}>
                {item.label}
              </div>
              <div className="text-xs font-medium mt-0.5" style={{ color: item.color }}>
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
          Edit window: {editWindowOpen ? 'Open now!' : 'Opens after Over 50'}
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

      {/* Player cards */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '10px 12px' }}>
        <div
          className="text-[9px] uppercase tracking-[1px] mb-2 py-0.5"
          style={{ color: 'var(--mu)' }}
        >
          Your squad
        </div>

        {(game
          ? game.player_weightages.map((pw, i) => ({
              id: pw.player_id,
              initials: pw.player_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase(),
              name: pw.player_name,
              role: `${pw.team}`,
              pts: pw.points_earned,
              wt: pw.weightage,
            }))
          : SAMPLE_PLAYERS
        ).map((player, i) => (
          <div
            key={player.id}
            className="flex items-center gap-2.5 rounded-[10px] mb-[7px]"
            style={{
              background: 'var(--s1)',
              border: '0.5px solid var(--b1)',
              padding: '10px 12px',
            }}
          >
            {/* Avatar */}
            <div
              className="w-[34px] h-[34px] rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
              style={{
                background: AVATAR_STYLES[i % AVATAR_STYLES.length].bg,
                color: AVATAR_STYLES[i % AVATAR_STYLES.length].color,
              }}
            >
              {player.initials}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium" style={{ color: 'var(--tx)' }}>
                {player.name}
              </div>
              <div className="text-[10px] mt-0.5" style={{ color: 'var(--mu)' }}>
                {player.role}
              </div>
              {player.pts > 0 && (
                <div className="text-[10px] mt-0.5" style={{ color: 'var(--green)' }}>
                  +{player.pts} pts
                </div>
              )}
            </div>

            {/* Weightage control */}
            <div className="flex items-center gap-1.5">
              <button
                className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-[13px] font-medium cursor-pointer transition-all"
                style={{
                  border: '0.5px solid var(--b2)',
                  background: 'var(--s2)',
                  color: 'var(--tx)',
                }}
              >
                &minus;
              </button>
              <div
                className="font-syne text-[13px] font-bold min-w-[16px] text-center"
                style={{ color: 'var(--gold)' }}
              >
                {player.wt}
              </div>
              <button
                className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-[13px] font-medium cursor-pointer transition-all"
                style={{
                  border: '0.5px solid var(--b2)',
                  background: 'var(--s2)',
                  color: 'var(--tx)',
                }}
              >
                +
              </button>
            </div>
          </div>
        ))}
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
              <div
                className="text-[10px] leading-[1.4] mb-2"
                style={{ color: 'var(--mu)' }}
              >
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
