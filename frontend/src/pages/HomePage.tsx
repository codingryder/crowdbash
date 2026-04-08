import { RoomsList } from '../components/rooms/RoomsList';

export function HomePage() {
  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="font-syne font-bold text-3xl mb-2">
          <span className="text-gold">Crowdbash</span>
        </h1>
        <p className="text-sm text-white/50">
          Join live cricket fan rooms. Watch scores, chat, play the Weightage Game, and compete!
        </p>
      </div>

      <RoomsList />
    </main>
  );
}
