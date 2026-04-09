import { MatchHeader } from './MatchHeader';
import type { Room } from '../../types';

interface LeftSidebarProps {
  room: Room;
}

export function LeftSidebar({ room }: LeftSidebarProps) {
  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{ borderRight: '0.5px solid var(--b1)' }}
    >
      <MatchHeader room={room} />

      {/* Match Info */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '14px 16px' }}>
        {/* Match details */}
        <div className="mb-4">
          <div className="text-[9px] uppercase tracking-[1px] mb-3" style={{ color: 'var(--mu)' }}>
            Match Info
          </div>

          {room.venue && (
            <div className="flex justify-between py-2" style={{ borderBottom: '0.5px solid var(--b1)' }}>
              <span className="text-[11px]" style={{ color: 'var(--mu)' }}>Venue</span>
              <span className="text-[11px] font-medium" style={{ color: 'var(--tx)' }}>{room.venue}</span>
            </div>
          )}

          {room.match_format && (
            <div className="flex justify-between py-2" style={{ borderBottom: '0.5px solid var(--b1)' }}>
              <span className="text-[11px]" style={{ color: 'var(--mu)' }}>Format</span>
              <span className="text-[11px] font-medium capitalize" style={{ color: 'var(--tx)' }}>{room.match_format}</span>
            </div>
          )}

          {room.league && (
            <div className="flex justify-between py-2" style={{ borderBottom: '0.5px solid var(--b1)' }}>
              <span className="text-[11px]" style={{ color: 'var(--mu)' }}>League</span>
              <span className="text-[11px] font-medium" style={{ color: 'var(--tx)' }}>{room.league}</span>
            </div>
          )}

          <div className="flex justify-between py-2" style={{ borderBottom: '0.5px solid var(--b1)' }}>
            <span className="text-[11px]" style={{ color: 'var(--mu)' }}>Sport</span>
            <span className="text-[11px] font-medium capitalize" style={{ color: 'var(--tx)' }}>
              {room.sport === 'football' ? '\u26BD Football' : '\uD83C\uDFCF Cricket'}
            </span>
          </div>

          <div className="flex justify-between py-2">
            <span className="text-[11px]" style={{ color: 'var(--mu)' }}>Status</span>
            <span
              className="text-[11px] font-medium capitalize"
              style={{
                color: room.status === 'live' ? 'var(--green)' : room.status === 'completed' ? 'var(--mu)' : 'var(--gold)',
              }}
            >
              {room.status}
            </span>
          </div>
        </div>

        {/* Completed match summary */}
        {room.status === 'completed' && (
          <div
            className="rounded-xl p-3.5"
            style={{ background: 'var(--s2)', border: '0.5px solid var(--b1)' }}
          >
            <div className="text-[9px] uppercase tracking-[1px] mb-2" style={{ color: 'var(--mu)' }}>
              Match Result
            </div>
            <div className="font-syne text-[13px] font-bold" style={{ color: 'var(--tx)' }}>
              {room.match_name}
            </div>
            <div className="text-[11px] mt-1" style={{ color: 'var(--mu)' }}>
              Match completed
            </div>
          </div>
        )}

        {/* Upcoming info */}
        {room.status === 'upcoming' && (
          <div
            className="rounded-xl p-3.5 text-center"
            style={{ background: 'var(--s2)', border: '0.5px solid var(--b1)' }}
          >
            <div className="text-2xl mb-2">
              {room.sport === 'football' ? '\u26BD' : '\uD83C\uDFCF'}
            </div>
            <div className="text-[12px] font-medium mb-1" style={{ color: 'var(--tx)' }}>
              Match hasn&apos;t started yet
            </div>
            <div className="text-[11px]" style={{ color: 'var(--mu)' }}>
              Join the room to be notified when it goes live
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
