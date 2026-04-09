import type { Room } from '../../types';

interface RoomBarProps {
  room: Room;
  fanCount: number;
}

export function RoomBar({ room, fanCount }: RoomBarProps) {
  return (
    <div
      className="flex items-center gap-2 md:gap-6 px-3 md:px-8 shrink-0"
      style={{
        height: 40,
        borderTop: '0.5px solid var(--b1)',
        background: 'var(--bg)',
      }}
    >
      <div
        className="flex items-center gap-1 text-[10px] md:text-xs truncate"
        style={{ color: 'var(--tx)' }}
      >
        <span style={{ color: 'var(--gold)' }}>⚡</span>
        <span className="truncate">{room.match_name}</span>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-1 text-[10px] md:text-xs shrink-0" style={{ color: 'var(--mu)' }}>
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--green)' }} />
        {fanCount > 0 ? fanCount.toLocaleString() : '—'} fans
      </div>
    </div>
  );
}
