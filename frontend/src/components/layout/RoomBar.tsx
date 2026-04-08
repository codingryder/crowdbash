import { LivePill } from '../ui/LivePill';
import { Badge } from '../ui/Badge';
import type { Room } from '../../types';

interface RoomBarProps {
  room: Room;
  fanCount: number;
}

export function RoomBar({ room, fanCount }: RoomBarProps) {
  return (
    <div className="bg-surface2 border-b border-white/[0.07] px-4 py-2">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="font-syne font-semibold text-sm">{room.match_name}</h2>
          {room.status === 'live' && <LivePill />}
          <Badge variant="blue">{room.match_format}</Badge>
        </div>
        <div className="flex items-center gap-2 text-xs text-white/50">
          <span>{fanCount} fans watching</span>
        </div>
      </div>
    </div>
  );
}
