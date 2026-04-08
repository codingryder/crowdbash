interface StatBar {
  label: string;
  value: string;
  width: string;
  color: string;
}

interface StatCard {
  title: string;
  bars: StatBar[];
}

// Sample stat data — will be replaced with live data
const SAMPLE_STATS: StatCard[] = [
  {
    title: 'Top scorers',
    bars: [
      { label: 'V. Kohli', value: '94*', width: '78%', color: 'var(--blue)' },
      { label: 'R. Sharma', value: '71', width: '59%', color: 'var(--gold2)' },
      { label: 'KL Rahul', value: '38', width: '31%', color: 'var(--purple)' },
      { label: 'H. Pandya', value: '29', width: '24%', color: 'var(--green)' },
    ],
  },
  {
    title: 'Run rate by phase',
    bars: [
      { label: 'Powerplay (1-10)', value: '6.40', width: '65%', color: 'var(--green)' },
      { label: 'Middle (11-40)', value: '5.50', width: '55%', color: 'var(--blue)' },
      { label: 'Death (41-50)', value: '8.10', width: '81%', color: 'var(--gold)' },
    ],
  },
];

export function StatsSidebar() {
  return (
    <div style={{ padding: '14px 18px' }}>
      {SAMPLE_STATS.map((card) => (
        <div
          key={card.title}
          className="rounded-xl p-3.5 mb-3"
          style={{
            background: 'var(--s1)',
            border: '0.5px solid var(--b1)',
          }}
        >
          <div className="font-syne text-[13px] font-bold mb-3">{card.title}</div>
          {card.bars.map((bar) => (
            <div key={bar.label} className="mb-2">
              <div
                className="flex justify-between text-[11px] mb-1"
                style={{ color: 'var(--mu)' }}
              >
                <span>{bar.label}</span>
                <span style={{ color: 'var(--gold)' }}>{bar.value}</span>
              </div>
              <div
                className="h-1 rounded"
                style={{ background: 'var(--s3)' }}
              >
                <div
                  className="h-1 rounded"
                  style={{ width: bar.width, background: bar.color }}
                />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
