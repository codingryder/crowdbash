import { useState } from 'react';
import type { SquadPlayer } from '../../types';
import { PlayerAvatar } from '../ui/PlayerAvatar';
import { usePlayingXi } from '../../hooks/usePlayingXi';

const ROLE_COLORS: Record<string, { label: string; color: string }> = {
  'batsman': { label: 'BAT', color: 'var(--blue)' },
  'bowler': { label: 'BOWL', color: 'var(--green)' },
  'all-rounder': { label: 'AR', color: 'var(--purple)' },
  'wicket-keeper': { label: 'WK', color: 'var(--amber)' },
  // Football
  'GK': { label: 'GK', color: 'var(--amber)' },
  'DEF': { label: 'DEF', color: 'var(--blue)' },
  'MID': { label: 'MID', color: 'var(--green)' },
  'FWD': { label: 'FWD', color: 'var(--red)' },
};

interface PlayerSelectorSheetProps {
  positionLabel: string;
  suggestedRole?: string;
  availablePlayers: SquadPlayer[];
  assignedPlayerIds: Set<string>; // players already on field
  currentPlayerId?: string; // player currently at this position
  onSelect: (playerId: string) => void;
  onRemove: () => void;
  onClose: () => void;
}

export function PlayerSelectorSheet({
  positionLabel,
  suggestedRole,
  availablePlayers,
  assignedPlayerIds,
  currentPlayerId,
  onSelect,
  onRemove,
  onClose,
}: PlayerSelectorSheetProps) {
  const [roleFilter, setRoleFilter] = useState(suggestedRole || 'all');
  const [search, setSearch] = useState('');
  const { announced, isInXi } = usePlayingXi();

  const roles = [...new Set(availablePlayers.map(p => p.player_role).filter(Boolean))];

  const filtered = availablePlayers.filter(p => {
    if (roleFilter !== 'all' && p.player_role !== roleFilter) return false;
    if (search && !p.player_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Group by team
  const teams = [...new Set(filtered.map(p => p.team))];

  return (
    <div
      className="fixed inset-0 z-[950] flex flex-col justify-end"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="rounded-t-2xl flex flex-col"
        style={{ background: 'var(--surface)', maxHeight: '65vh', border: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 16, fontWeight: 800 }}>
              Select for {positionLabel}
            </div>
            <div className="text-[11px]" style={{ color: 'var(--muted)' }}>{filtered.length} players available</div>
          </div>
          <div className="flex items-center gap-2">
            {currentPlayerId && (
              <button
                onClick={onRemove}
                style={{ fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 7, background: 'rgba(240,82,82,0.08)', color: 'var(--red)', border: '1px solid rgba(240,82,82,0.2)', cursor: 'pointer' }}
              >
                Remove
              </button>
            )}
            <button onClick={onClose} className="text-lg bg-transparent border-none cursor-pointer" style={{ color: 'var(--muted)' }}>✕</button>
          </div>
        </div>

        {/* Search + filters */}
        <div className="px-5 py-3 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search player..."
            style={{
              width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'var(--text)',
              outline: 'none', boxSizing: 'border-box', marginBottom: 8,
            }}
          />
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => setRoleFilter('all')}
              style={{
                padding: '4px 12px', fontSize: 10, fontWeight: 700, borderRadius: 20, cursor: 'pointer',
                background: roleFilter === 'all' ? 'var(--green)' : 'var(--surface2)',
                color: roleFilter === 'all' ? '#071a0e' : 'var(--muted)',
                border: roleFilter === 'all' ? '1px solid var(--green)' : '1px solid var(--border)',
              }}
            >
              All
            </button>
            {roles.map(r => {
              const rc = ROLE_COLORS[r] || { label: r.slice(0, 3).toUpperCase(), color: 'var(--muted)' };
              return (
                <button
                  key={r}
                  onClick={() => setRoleFilter(r)}
                  style={{
                    padding: '4px 12px', fontSize: 10, fontWeight: 700, borderRadius: 20, cursor: 'pointer',
                    background: roleFilter === r ? rc.color : 'var(--surface2)',
                    color: roleFilter === r ? '#071a0e' : rc.color,
                    border: `1px solid ${roleFilter === r ? rc.color : 'var(--border)'}`,
                  }}
                >
                  {rc.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Player list */}
        <div className="flex-1 overflow-y-auto">
          {teams.map(team => (
            <div key={team}>
              <div className="px-5 py-2 text-[10px] font-bold uppercase tracking-[1.5px]" style={{ color: 'var(--muted)', background: 'var(--bg2)' }}>
                {team}
              </div>
              {filtered.filter(p => p.team === team).map(player => {
                const isAssigned = assignedPlayerIds.has(player.player_id) && player.player_id !== currentPlayerId;
                const isCurrent = player.player_id === currentPlayerId;
                const rc = ROLE_COLORS[player.player_role] || { label: '?', color: 'var(--muted)' };

                return (
                  <button
                    key={player.player_id}
                    onClick={() => !isAssigned && onSelect(player.player_id)}
                    disabled={isAssigned}
                    className="w-full flex items-center gap-3 px-5 py-2.5 border-none cursor-pointer text-left"
                    style={{
                      background: isCurrent ? 'rgba(45,214,122,0.06)' : 'transparent',
                      opacity: isAssigned ? 0.35 : 1,
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <PlayerAvatar
                      name={player.player_name}
                      imageUrl={player.image_url}
                      size={32}
                      radius={16}
                      fontSize={10}
                    />

                    {/* Name + role */}
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium truncate flex items-center gap-1.5" style={{ color: 'var(--text)' }}>
                        {announced && (
                          <span
                            title={isInXi(player.player_name) ? 'In playing XI' : 'Not in playing XI'}
                            style={{
                              display: 'inline-block',
                              width: 7,
                              height: 7,
                              borderRadius: '50%',
                              background: isInXi(player.player_name) ? 'var(--green)' : 'var(--muted)',
                              flexShrink: 0,
                            }}
                          />
                        )}
                        <span className="truncate">{player.player_name}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span style={{ fontSize: 9, fontWeight: 700, color: rc.color }}>{rc.label}</span>
                        {announced && !isInXi(player.player_name) && (
                          <span className="text-[9px]" style={{ color: 'var(--muted)' }}>not in XI</span>
                        )}
                        {isAssigned && <span className="text-[9px]" style={{ color: 'var(--muted)' }}>on field</span>}
                        {isCurrent && <span className="text-[9px]" style={{ color: 'var(--green)' }}>current</span>}
                      </div>
                    </div>

                    {/* Select indicator */}
                    {!isAssigned && (
                      <div style={{
                        width: 24, height: 24, borderRadius: '50%',
                        border: isCurrent ? '2px solid var(--green)' : '1.5px solid var(--border)',
                        background: isCurrent ? 'var(--green)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: isCurrent ? '#071a0e' : 'transparent',
                        fontSize: 12, fontWeight: 900,
                      }}>
                        {isCurrent ? '✓' : ''}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
