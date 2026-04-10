import type { Room } from '../../types';

interface Props {
  room: Room;
  fanCount: number;
}

export function RoomBar({ room, fanCount }: Props) {
  return (
    <div
      className="flex items-center gap-2 md:gap-4 px-3 md:px-6 shrink-0"
      style={{ height: 42, borderTop: '1px solid var(--b1)', background: 'var(--bg)' }}
    >
      <div className="flex items-center gap-1.5 text-[11px] md:text-[12px] truncate" style={{ color: 'var(--tx2)' }}>
        <span style={{ color: 'var(--green)' }}>⚡</span>
        <span className="font-cabinet font-bold truncate">{room.match_name}</span>
      </div>
      <div className="flex-1" />
      <div className="flex items-center gap-1.5 text-[10px] md:text-[11px] shrink-0" style={{ color: 'var(--mu)' }}>
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--green)' }} />
        {fanCount > 0 ? fanCount.toLocaleString() : '—'} fans
      </div>
    </div>
  );
}
