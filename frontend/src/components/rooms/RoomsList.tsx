import { useState, useEffect } from 'react';
import api from '../../lib/api';
import type { Room } from '../../types';
import { RoomCard } from './RoomCard';

export function RoomsList() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRooms() {
      try {
        const { data } = await api.get('/api/rooms/');
        setRooms(data);
      } catch (err) {
        console.error('Failed to fetch rooms', err);
      } finally {
        setLoading(false);
      }
    }
    fetchRooms();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-surface2 rounded-xl border border-white/[0.07] p-4 animate-pulse"
          >
            <div className="h-4 bg-surface3 rounded w-1/3 mb-3" />
            <div className="h-6 bg-surface3 rounded w-2/3 mb-2" />
            <div className="h-3 bg-surface3 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (rooms.length === 0) {
    return (
      <div className="text-center py-16">
        <h3 className="font-syne text-lg text-white/50 mb-2">No rooms available</h3>
        <p className="text-sm text-white/30">
          Rooms are created when live cricket matches start.
        </p>
      </div>
    );
  }

  // Separate live, upcoming, completed
  const liveRooms = rooms.filter((r) => r.status === 'live');
  const upcomingRooms = rooms.filter((r) => r.status === 'upcoming');
  const completedRooms = rooms.filter((r) => r.status === 'completed');

  return (
    <div className="space-y-8">
      {liveRooms.length > 0 && (
        <section>
          <h2 className="font-syne font-bold text-lg text-gold mb-4">Live Now</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {liveRooms.map((room) => (
              <RoomCard key={room.id} room={room} />
            ))}
          </div>
        </section>
      )}

      {upcomingRooms.length > 0 && (
        <section>
          <h2 className="font-syne font-bold text-lg text-white/70 mb-4">Upcoming</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcomingRooms.map((room) => (
              <RoomCard key={room.id} room={room} />
            ))}
          </div>
        </section>
      )}

      {completedRooms.length > 0 && (
        <section>
          <h2 className="font-syne font-bold text-lg text-white/40 mb-4">Completed</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {completedRooms.map((room) => (
              <RoomCard key={room.id} room={room} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
