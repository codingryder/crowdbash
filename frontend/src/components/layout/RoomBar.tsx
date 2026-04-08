import type { Room } from '../../types';

interface RoomBarProps {
  room: Room;
  fanCount: number;
}

export function RoomBar({ room, fanCount }: RoomBarProps) {
  return (
    <div
      className="flex items-center gap-6 px-8 shrink-0"
      style={{
        height: 48,
        borderTop: '0.5px solid var(--b1)',
        background: 'var(--bg)',
      }}
    >
      <div
        className="flex items-center gap-[5px] text-xs px-2 py-1 rounded-md"
        style={{ color: 'var(--tx)' }}
      >
        <span style={{ color: 'var(--gold)' }}>&#9889;</span> {room.match_name}
      </div>
      <div className="text-xs" style={{ color: 'var(--mu)' }}>
        Over {room.current_over}
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-[5px] text-xs" style={{ color: 'var(--mu)' }}>
        <div
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: 'var(--green)' }}
        />
        {fanCount > 0 ? fanCount.toLocaleString() : '—'} fans watching
      </div>
    </div>
  );
}
