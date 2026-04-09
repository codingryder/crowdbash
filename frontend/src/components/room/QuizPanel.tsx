import { useState, type CSSProperties } from 'react';
import { useRoomStore } from '../../store/roomStore';

// Sample quiz data for mockup
const SAMPLE_ANSWERED = {
  question: 'How many ODI centuries has Virat Kohli scored in his career?',
  options: [
    { text: 'A. 50', pct: '67%', status: 'correct' as const },
    { text: 'B. 46', pct: '21%', status: 'wrong' as const },
    { text: 'C. 53', pct: '12%', status: 'neutral' as const },
  ],
};

const SAMPLE_LIVE = {
  question: 'Which Australian bowler has taken the most wickets against India in ODIs?',
  options: ['A. Mitchell Starc', 'B. Glenn McGrath', 'C. Shane Warne'],
  timerPct: 65,
  timerSec: 13,
};

export function QuizPanel() {
  // Will be wired to live quiz data
  useRoomStore((s) => s.activeQuiz);
  const [selectedLive, setSelectedLive] = useState<number | null>(null);

  return (
    <div style={{ padding: '14px 18px' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3.5">
        <div className="font-syne text-[15px] font-bold">Live quiz</div>
        <div
          className="text-[11px] py-0.5 px-2.5 rounded-[20px]"
          style={{ background: 'rgba(61,214,140,0.08)', color: 'var(--green)' }}
        >
          +50 pts per correct
        </div>
      </div>

      {/* Answered question */}
      <div
        className="rounded-xl p-3.5 mb-3"
        style={{ background: 'var(--s1)', border: '0.5px solid var(--b1)' }}
      >
        <div
          className="inline-flex items-center gap-[5px] text-[10px] font-semibold uppercase tracking-[0.5px] px-2.5 py-0.5 rounded-[20px] mb-2.5"
          style={{ background: 'rgba(139,111,255,0.1)', color: 'var(--purple)' }}
        >
          Answered
        </div>
        <div className="text-[13px] font-medium leading-[1.5] mb-3" style={{ color: 'var(--tx)' }}>
          {SAMPLE_ANSWERED.question}
        </div>
        {SAMPLE_ANSWERED.options.map((opt, i) => {
          let optStyle: CSSProperties = { background: 'var(--s2)', border: '0.5px solid var(--b1)', color: 'var(--tx)' };
          let pctColor = 'var(--dm)';
          if (opt.status === 'correct') {
            optStyle = { background: 'rgba(61,214,140,0.07)', border: '0.5px solid var(--green)', color: 'var(--green)' };
            pctColor = 'var(--green)';
          } else if (opt.status === 'wrong') {
            optStyle = { background: 'rgba(240,90,90,0.05)', border: '0.5px solid var(--red)', color: 'var(--red)' };
            pctColor = 'var(--red)';
          } else {
            optStyle.opacity = 0.5;
          }

          return (
            <div
              key={i}
              className="flex items-center justify-between rounded-lg px-3 py-2.5 mb-[7px] text-xs"
              style={optStyle}
            >
              <span>{opt.text}{opt.status === 'correct' ? ' ✓' : ''}</span>
              <span className="text-[11px]" style={{ color: pctColor }}>{opt.pct} picked</span>
            </div>
          );
        })}
      </div>

      {/* Live question */}
      <div
        className="rounded-xl p-3.5 mb-3"
        style={{ background: 'var(--s1)', border: '0.5px solid var(--b1)' }}
      >
        <div
          className="inline-flex items-center gap-[5px] text-[10px] font-semibold uppercase tracking-[0.5px] px-2.5 py-0.5 rounded-[20px] mb-2.5"
          style={{ background: 'rgba(244,185,64,0.1)', color: 'var(--gold)' }}
        >
          Live now
        </div>
        <div className="text-[13px] font-medium leading-[1.5] mb-3" style={{ color: 'var(--tx)' }}>
          {SAMPLE_LIVE.question}
        </div>
        {SAMPLE_LIVE.options.map((opt, i) => (
          <div
            key={i}
            onClick={() => setSelectedLive(i)}
            className="rounded-lg px-3 py-2.5 mb-[7px] text-xs cursor-pointer transition-colors"
            style={{
              background: selectedLive === i ? 'rgba(61,214,140,0.07)' : 'var(--s2)',
              border: selectedLive === i ? '0.5px solid var(--green)' : '0.5px solid var(--b1)',
              color: selectedLive === i ? 'var(--green)' : 'var(--tx)',
              opacity: selectedLive !== null && selectedLive !== i ? 0.5 : 1,
            }}
          >
            {opt}
          </div>
        ))}
        {/* Timer bar */}
        <div className="flex items-center gap-2 mt-2">
          <div className="flex-1 h-[3px] rounded" style={{ background: 'var(--s3)' }}>
            <div
              className="h-[3px] rounded transition-all"
              style={{ width: `${SAMPLE_LIVE.timerPct}%`, background: 'var(--gold)' }}
            />
          </div>
          <div className="text-[10px]" style={{ color: 'var(--mu)' }}>
            {SAMPLE_LIVE.timerSec}s
          </div>
        </div>
      </div>

      {/* Quiz score */}
      <div
        className="flex items-center justify-between rounded-[10px] px-3.5 py-3"
        style={{ background: 'var(--s1)', border: '0.5px solid var(--b1)' }}
      >
        <div>
          <div className="text-[10px] uppercase tracking-[0.5px] mb-1" style={{ color: 'var(--mu)' }}>
            Your quiz score
          </div>
          <div className="font-syne text-xl font-extrabold" style={{ color: 'var(--gold)' }}>
            350 pts
          </div>
        </div>
        <div className="text-xs" style={{ color: 'var(--green)' }}>
          Rank #18 of 2,841
        </div>
      </div>
    </div>
  );
}
