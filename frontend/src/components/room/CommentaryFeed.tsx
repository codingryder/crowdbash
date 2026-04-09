import type { CSSProperties } from 'react';
import { useRoomStore } from '../../store/roomStore';

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

interface SampleEvent {
  type: string;
  commentary: string;
  meta: string;
}

const CRICKET_SAMPLES: SampleEvent[] = [
  { type: 'six', commentary: "Kohli goes downtown! Massive SIX over deep midwicket. The crowd erupts!", meta: '48.3 \u00b7 V Kohli (94*)' },
  { type: 'dot', commentary: 'Dot ball. Kohli defends firmly to mid-on. Good length delivery.', meta: '48.2 \u00b7 V Kohli (88)' },
  { type: 'boundary', commentary: 'Driven beautifully through covers! Pure class from the master batter.', meta: '48.1 \u00b7 V Kohli (88)' },
  { type: 'wicket', commentary: 'WICKET! Sharma caught behind! Maxwell got the edge.', meta: '47.6 \u00b7 R Sharma (71)' },
  { type: 'single', commentary: 'Clipped to fine leg for a single. India rotating strike well.', meta: '47.5 \u00b7 R Sharma (71)' },
  { type: 'six', commentary: "Sharma goes big! Cummins tries a yorker and Rohit heaves it over long-on!", meta: '47.4 \u00b7 R Sharma (70)' },
];

const FOOTBALL_SAMPLES: SampleEvent[] = [
  { type: 'goal', commentary: "GOAL! Saka cuts inside and curls it into the far corner! Arsenal take the lead!", meta: "67' \u00b7 B. Saka \u00b7 Arsenal" },
  { type: 'assist', commentary: 'Brilliant through ball from Odegaard to set up the goal.', meta: "67' \u00b7 M. Odegaard \u00b7 Arsenal" },
  { type: 'yellow_card', commentary: 'Yellow card for a late tackle in midfield. Referee had no choice.', meta: "54' \u00b7 R. James \u00b7 Chelsea" },
  { type: 'save', commentary: 'Brilliant save! Raya dives full stretch to deny Palmer.', meta: "41' \u00b7 D. Raya \u00b7 Arsenal" },
  { type: 'substitution', commentary: 'Tactical change at halftime. Fresh legs in midfield.', meta: "46' \u00b7 Substitution \u00b7 Chelsea" },
  { type: 'goal', commentary: "EQUALIZER! Palmer scores from the penalty spot. Cool as you like.", meta: "38' \u00b7 C. Palmer \u00b7 Chelsea" },
];

export function CommentaryFeed() {
  const sport = useRoomStore((s) => s.sport);
  const samples = sport === 'football' ? FOOTBALL_SAMPLES : CRICKET_SAMPLES;
  const chipStyles = sport === 'football' ? footballChipStyles : cricketChipStyles;
  const chipLabels = sport === 'football' ? footballChipLabels : cricketChipLabels;

  return (
    <div>
      {samples.map((event, i) => (
        <div
          key={i}
          className="flex gap-3"
          style={{ padding: '12px 18px', borderBottom: '0.5px solid var(--b1)' }}
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5"
            style={chipStyles[event.type] || { background: 'var(--s2)', color: 'var(--mu)' }}
          >
            {chipLabels[event.type] || '?'}
          </div>
          <div>
            <div className="text-[13px] leading-[1.55]" style={{ color: 'var(--tx)' }}>
              {event.commentary}
            </div>
            <div className="text-[11px] mt-0.5" style={{ color: 'var(--mu)' }}>
              {event.meta}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
