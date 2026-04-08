interface BallEvent {
  over: string;
  runs: number;
  type: 'dot' | 'single' | 'boundary' | 'six' | 'wicket';
  commentary: string;
  batter: string;
}

const chipStyles: Record<string, string> = {
  six: 'background: rgba(244,185,64,0.12); color: var(--gold)',
  boundary: 'background: rgba(74,158,255,0.12); color: var(--blue)',
  wicket: 'background: rgba(240,90,90,0.12); color: var(--red)',
  dot: 'background: var(--s2); color: var(--mu)',
  single: 'background: rgba(61,214,140,0.1); color: var(--green)',
};

const chipLabels: Record<string, string> = {
  six: '6',
  boundary: '4',
  wicket: 'W',
  dot: '\u2022',
  single: '1',
};

// Sample data — will be wired to live WS
const SAMPLE_BALLS: BallEvent[] = [
  { over: '48.3', runs: 6, type: 'six', commentary: "Kohli goes downtown! Starc drops it short and Kohli pulls it over deep midwicket for a massive SIX. The crowd erupts!", batter: 'V Kohli (94*)' },
  { over: '48.2', runs: 0, type: 'dot', commentary: 'Dot ball. Kohli defends firmly to mid-on. Good length delivery, keeping it tight.', batter: 'V Kohli (88)' },
  { over: '48.1', runs: 4, type: 'boundary', commentary: 'Driven beautifully through covers! Kohli finds the gap and races away. Pure class from the master batter.', batter: 'V Kohli (88)' },
  { over: '47.6', runs: 0, type: 'wicket', commentary: "WICKET! Sharma caught behind! Maxwell got the edge and Inglis takes a sharp catch. India lose their 7th wicket.", batter: 'R Sharma (71)' },
  { over: '47.5', runs: 1, type: 'single', commentary: 'Clipped to fine leg for a single. India rotating strike well in the death overs.', batter: 'R Sharma (71)' },
  { over: '47.4', runs: 6, type: 'six', commentary: "Sharma goes big! Cummins tries a yorker but it's slightly full and Rohit heaves it over long-on!", batter: 'R Sharma (70)' },
  { over: '47.3', runs: 4, type: 'boundary', commentary: 'Edged but through the gap at third man! Lucky boundary for Sharma.', batter: 'R Sharma (64)' },
  { over: '47.2', runs: 0, type: 'dot', commentary: 'Full length delivery, Kohli drives but finds the fielder at mid-off. Good bowling from Cummins.', batter: 'V Kohli (84)' },
];

export function CommentaryFeed() {
  return (
    <div>
      {SAMPLE_BALLS.map((ball, i) => (
        <div
          key={i}
          className="flex gap-3"
          style={{ padding: '12px 18px', borderBottom: '0.5px solid var(--b1)' }}
        >
          {/* Ball chip */}
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5"
            style={{ cssText: chipStyles[ball.type] }}
          >
            {chipLabels[ball.type]}
          </div>

          {/* Text */}
          <div>
            <div className="text-[13px] leading-[1.55]" style={{ color: 'var(--tx)' }}>
              {ball.commentary}
            </div>
            <div className="text-[11px] mt-0.5" style={{ color: 'var(--mu)' }}>
              {ball.over} &middot; {ball.batter}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
