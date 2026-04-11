import { useState } from 'react';
import { MatchHeader } from './MatchHeader';
import { ScorecardModal } from './ScorecardModal';
import { useRoomStore } from '../../store/roomStore';
import type { Room } from '../../types';
import { formatMatchDate } from '../../types';

interface LeftSidebarProps {
  room: Room;
  lastUpdated?: Date | null;
  onRefresh?: () => void;
}

interface BatterInfo {
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
}

interface BowlerInfo {
  name: string;
  wickets: number;
  runs: number;
  overs: string;
}

export function LeftSidebar({ room, lastUpdated, onRefresh }: LeftSidebarProps) {
  const [showScorecard, setShowScorecard] = useState(false);
  const score = useRoomStore((s) => s.score);

  // Extract current batting/bowling from score data
  const scoreData = score as Record<string, unknown> | null;
  const currentBatting = (scoreData?.current_batting as BatterInfo[]) || [];
  const currentBowling = (scoreData?.current_bowling as BowlerInfo[]) || [];

  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{ borderRight: '0.5px solid var(--b1)' }}
    >
      <MatchHeader room={room} />

      <div className="flex-1 overflow-y-auto" style={{ padding: '14px 16px' }}>
        {/* Match details */}
        <div className="mb-4">
          <div className="text-[9px] uppercase tracking-[1px] mb-3" style={{ color: 'var(--mu)' }}>
            Match Info
          </div>

          {room.match_date && (
            <div className="flex justify-between py-2" style={{ borderBottom: '0.5px solid var(--b1)' }}>
              <span className="text-[11px]" style={{ color: 'var(--mu)' }}>Date</span>
              <span className="text-[11px] font-medium" style={{ color: 'var(--gold)' }}>{formatMatchDate(room.match_date)}</span>
            </div>
          )}
          {room.venue && (
            <div className="flex justify-between py-2" style={{ borderBottom: '0.5px solid var(--b1)' }}>
              <span className="text-[11px]" style={{ color: 'var(--mu)' }}>Venue</span>
              <span className="text-[11px] font-medium" style={{ color: 'var(--tx)' }}>{room.venue}</span>
            </div>
          )}
          <div className="flex justify-between py-2" style={{ borderBottom: '0.5px solid var(--b1)' }}>
            <span className="text-[11px]" style={{ color: 'var(--mu)' }}>Status</span>
            <span className="text-[11px] font-medium capitalize"
              style={{ color: room.status === 'locked' ? 'var(--green)' : room.status === 'closed' ? 'var(--mu)' : 'var(--gold)' }}>
              {room.status}
            </span>
          </div>
        </div>

        {/* Live match summary — current batters & bowlers */}
        {room.status === 'locked' && (currentBatting.length > 0 || currentBowling.length > 0) && (
          <div className="mb-4">
            <div className="text-[9px] uppercase tracking-[1px] mb-2" style={{ color: 'var(--mu)' }}>
              At the Crease
            </div>

            {currentBatting.length > 0 && (
              <div className="rounded-lg p-2.5 mb-2" style={{ background: 'var(--s2)', border: '0.5px solid var(--b1)' }}>
                {currentBatting.map((bat, i) => (
                  <div key={i} className="flex items-center justify-between py-1">
                    <div>
                      <span className="text-[12px] font-medium" style={{ color: 'var(--tx)' }}>
                        {bat.name} {i === 0 ? '*' : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-syne text-[13px] font-bold" style={{ color: 'var(--gold)' }}>{bat.runs}</span>
                      <span className="text-[10px]" style={{ color: 'var(--mu)' }}>({bat.balls})</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {currentBowling.length > 0 && (
              <>
                <div className="text-[9px] uppercase tracking-[1px] mb-2" style={{ color: 'var(--mu)' }}>
                  Bowling
                </div>
                <div className="rounded-lg p-2.5 mb-2" style={{ background: 'var(--s2)', border: '0.5px solid var(--b1)' }}>
                  {currentBowling.slice(0, 2).map((bowl, i) => (
                    <div key={i} className="flex items-center justify-between py-1">
                      <span className="text-[12px] font-medium" style={{ color: 'var(--tx)' }}>{bowl.name}</span>
                      <span className="text-[12px]" style={{ color: 'var(--green)' }}>
                        {bowl.wickets}/{bowl.runs} ({bowl.overs})
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Action buttons */}
        {(room.status === 'locked' || room.status === 'closed') && (
          <div className="space-y-2 mb-4">
            <button
              onClick={() => setShowScorecard(true)}
              className="w-full py-2 rounded-lg text-[12px] font-semibold cursor-pointer font-syne border-none"
              style={{ background: 'var(--s2)', color: 'var(--gold)', border: '0.5px solid rgba(244,185,64,0.3)' }}
            >
              📋 View Scorecard
            </button>

            {room.status === 'locked' && onRefresh && (
              <button
                onClick={onRefresh}
                className="w-full py-2 rounded-lg text-[11px] cursor-pointer border-none flex items-center justify-center gap-1.5"
                style={{ background: 'var(--s2)', color: 'var(--mu)', border: '0.5px solid var(--b1)' }}
              >
                🔄 Refresh Scores
              </button>
            )}

            {lastUpdated && room.status === 'locked' && (
              <div className="text-[10px] text-center" style={{ color: 'var(--dm)' }}>
                Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                <span className="ml-1" style={{ color: 'var(--green)' }}>· Auto-refreshing</span>
              </div>
            )}
          </div>
        )}

        {/* Upcoming info */}
        {room.status === 'open' && (
          <div className="rounded-xl p-3.5 text-center" style={{ background: 'var(--s2)', border: '0.5px solid var(--b1)' }}>
            <div className="text-2xl mb-2">{room.sport === 'football' ? '⚽' : '🏏'}</div>
            <div className="text-[12px] font-medium mb-1" style={{ color: 'var(--tx)' }}>Match hasn&apos;t started yet</div>
            <div className="text-[11px]" style={{ color: 'var(--mu)' }}>Build your team before the match starts!</div>
          </div>
        )}
      </div>

      {/* Scorecard modal */}
      {showScorecard && (
        <ScorecardModal
          roomId={room.id}
          roomName={room.match_name}
          onClose={() => setShowScorecard(false)}
        />
      )}
    </div>
  );
}
