import type { CSSProperties } from 'react';
import { useRoomStore } from '../../store/roomStore';
import type { Room } from '../../types';

// Cricket chip styles
const cricketChipStyles: Record<string, CSSProperties> = {
  six: { background: 'rgba(244,185,64,0.12)', color: 'var(--gold)' },
  boundary: { background: 'rgba(74,158,255,0.12)', color: 'var(--blue)' },
  wicket: { background: 'rgba(240,90,90,0.12)', color: 'var(--red)' },
  dot: { background: 'var(--s2)', color: 'var(--mu)' },
  single: { background: 'rgba(61,214,140,0.1)', color: 'var(--green)' },
};

const cricketChipLabels: Record<string, string> = {
  six: '6', boundary: '4', wicket: 'W', dot: '\u2022', single: '1',
};

// Football chip styles
const footballChipStyles: Record<string, CSSProperties> = {
  goal: { background: 'rgba(244,185,64,0.12)', color: 'var(--gold)' },
  assist: { background: 'rgba(74,158,255,0.12)', color: 'var(--blue)' },
  yellow_card: { background: 'rgba(244,185,64,0.15)', color: '#E8C94A' },
  red_card: { background: 'rgba(240,90,90,0.12)', color: 'var(--red)' },
  substitution: { background: 'var(--s2)', color: 'var(--mu)' },
  save: { background: 'rgba(61,214,140,0.1)', color: 'var(--green)' },
};

const footballChipLabels: Record<string, string> = {
  goal: '\u26BD', assist: 'A', yellow_card: '\uD83D\uDFE8', red_card: '\uD83D\uDFE5', substitution: '\u21C4', save: 'S',
};

interface CommentaryFeedProps {
  room: Room;
}

export function CommentaryFeed({ room }: CommentaryFeedProps) {
  const matchEvents = useRoomStore((s) => s.matchEvents);
  const sport = room.sport;
  const chipStyles = sport === 'football' ? footballChipStyles : cricketChipStyles;
  const chipLabels = sport === 'football' ? footballChipLabels : cricketChipLabels;

  // Show real events from WebSocket if available
  if (matchEvents.length > 0) {
    return (
      <div>
        {matchEvents.map((event, i) => (
          <div
            key={event.id || i}
            className="flex gap-3"
            style={{ padding: '12px 18px', borderBottom: '0.5px solid var(--b1)' }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5"
              style={chipStyles[event.event_type] || { background: 'var(--s2)', color: 'var(--mu)' }}
            >
              {chipLabels[event.event_type] || '?'}
            </div>
            <div>
              <div className="text-[13px] leading-[1.55]" style={{ color: 'var(--tx)' }}>
                {event.commentary || `${event.event_type}: ${event.player_name}`}
              </div>
              <div className="text-[11px] mt-0.5" style={{ color: 'var(--mu)' }}>
                {event.over_number ? `${event.over_number} \u00b7 ` : ''}
                {event.minute ? `${event.minute}\u2019 \u00b7 ` : ''}
                {event.player_name} {event.team ? `\u00b7 ${event.team}` : ''}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Waiting state — no live data yet
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
      <div className="text-2xl mb-3">
        {sport === 'football' ? '\u26BD' : '\uD83C\uDFCF'}
      </div>
      <div className="font-syne text-sm font-bold mb-2" style={{ color: 'var(--tx)' }}>
        {room.match_name}
      </div>
      <div className="text-xs mb-1" style={{ color: 'var(--mu)' }}>
        {room.league || room.match_format}
      </div>
      {room.status === 'live' ? (
        <div className="text-xs mt-4" style={{ color: 'var(--gold)' }}>
          Waiting for live commentary...
        </div>
      ) : room.status === 'upcoming' ? (
        <div className="text-xs mt-4" style={{ color: 'var(--mu)' }}>
          Commentary will appear when the match goes live.
        </div>
      ) : (
        <div className="text-xs mt-4" style={{ color: 'var(--mu)' }}>
          Match completed.
        </div>
      )}
    </div>
  );
}
