import { Link } from 'react-router-dom';
import type { Room } from '../../types';
import { LivePill } from '../ui/LivePill';
import { Badge } from '../ui/Badge';

interface RoomCardProps {
  room: Room;
}

export function RoomCard({ room }: RoomCardProps) {
  return (
    <Link
      to={`/room/${room.id}`}
      className="block bg-surface2 rounded-xl border border-white/[0.07] p-4 hover:border-gold/20 transition group"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {room.status === 'locked' && <LivePill />}
          <Badge variant="blue">{room.match_format}</Badge>
        </div>
        <span className="text-xs text-white/40">{room.fan_count} fans</span>
      </div>

      <h3 className="font-syne font-semibold text-base mb-1 group-hover:text-gold transition">
        {room.match_name}
      </h3>
      <p className="text-xs text-white/40">{room.venue}</p>

      {room.status === 'locked' && room.current_over > 0 && (
        <div className="mt-3 pt-3 border-t border-white/[0.07]">
          <p className="text-xs text-white/50">
            Over: <span className="text-white/70">{room.current_over}</span>
          </p>
        </div>
      )}

      <div className="mt-3">
        <span className="inline-flex items-center px-3 py-1.5 bg-gold/10 text-gold text-xs font-semibold rounded-lg border border-gold/20 group-hover:bg-gold/20 transition">
          {room.status === 'locked' ? 'Join Room' : room.status === 'open' ? 'View Details' : 'View Results'}
        </span>
      </div>
    </Link>
  );
}
