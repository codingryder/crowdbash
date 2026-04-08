import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../lib/api';

interface LeaderboardEntry {
  user_id: string;
  points: number;
}

export function LeaderboardPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLeaderboard() {
      try {
        const { data } = await api.get(`/api/leaderboard/${roomId}`);
        setEntries(data);
      } catch {
        // Error fetching
      } finally {
        setLoading(false);
      }
    }
    if (roomId) fetchLeaderboard();
  }, [roomId]);

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-syne font-bold text-2xl">Leaderboard</h1>
        <Link
          to={`/room/${roomId}`}
          className="text-xs text-gold hover:text-gold/80 transition"
        >
          Back to Room
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-surface2 rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-surface3 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : entries.length === 0 ? (
        <p className="text-center text-white/30 py-8">No entries yet.</p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, i) => (
            <div
              key={entry.user_id}
              className={`flex items-center justify-between px-4 py-3 rounded-xl border ${
                i === 0
                  ? 'bg-gold/5 border-gold/20'
                  : 'bg-surface2 border-white/[0.07]'
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`font-syne font-bold text-lg w-8 ${
                    i === 0
                      ? 'text-gold'
                      : i === 1
                      ? 'text-white/70'
                      : i === 2
                      ? 'text-fanblue'
                      : 'text-white/40'
                  }`}
                >
                  #{i + 1}
                </span>
                <span className="text-sm">{entry.user_id.slice(0, 8)}...</span>
              </div>
              <span className="font-syne font-bold text-gold">{entry.points} pts</span>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
