interface BallEvent {
  over: string;
  ball: string;
  runs: number;
  type: 'dot' | 'single' | 'boundary' | 'six' | 'wicket' | 'other';
  commentary: string;
}

const ballChipStyles = {
  dot: 'bg-white/10 text-white/50',
  single: 'bg-white/10 text-white/70',
  boundary: 'bg-fanblue/20 text-fanblue',
  six: 'bg-gold-dim text-gold',
  wicket: 'bg-fanred/20 text-fanred',
  other: 'bg-white/10 text-white/50',
};

// Placeholder with sample data — will be wired to live WS data
const sampleBalls: BallEvent[] = [
  { over: '12.3', ball: '0', runs: 0, type: 'dot', commentary: 'Dot ball, good length outside off' },
  { over: '12.2', ball: '4', runs: 4, type: 'boundary', commentary: 'FOUR! Driven through covers' },
  { over: '12.1', ball: '6', runs: 6, type: 'six', commentary: 'SIX! Massive hit over long-on' },
  { over: '11.6', ball: '1', runs: 1, type: 'single', commentary: 'Single to mid-wicket' },
  { over: '11.5', ball: 'W', runs: 0, type: 'wicket', commentary: 'WICKET! Caught at slip' },
];

export function CommentaryFeed() {
  return (
    <div className="bg-surface2 rounded-xl border border-white/[0.07] flex flex-col">
      <div className="px-4 py-3 border-b border-white/[0.07]">
        <h3 className="font-syne font-semibold text-sm">Ball-by-Ball</h3>
      </div>
      <div className="flex-1 overflow-y-auto max-h-64 p-3 space-y-2">
        {sampleBalls.map((ball, i) => (
          <div key={i} className="flex items-start gap-3">
            <span
              className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${ballChipStyles[ball.type]}`}
            >
              {ball.type === 'wicket' ? 'W' : ball.runs}
            </span>
            <div>
              <p className="text-xs text-white/40">{ball.over}</p>
              <p className="text-sm text-white/80">{ball.commentary}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
