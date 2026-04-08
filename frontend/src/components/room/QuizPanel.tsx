import { useState } from 'react';
import { useRoomStore } from '../../store/roomStore';
import api from '../../lib/api';

export function QuizPanel() {
  const activeQuiz = useRoomStore((s) => s.activeQuiz);
  const [selected, setSelected] = useState<number | null>(null);
  const [result, setResult] = useState<{
    is_correct: boolean;
    correct_index: number;
    points_earned: number;
  } | null>(null);

  if (!activeQuiz) {
    return (
      <div className="bg-surface2 rounded-xl border border-white/[0.07] p-4">
        <h3 className="font-syne font-semibold text-sm mb-2">Quiz</h3>
        <p className="text-xs text-white/30 text-center py-4">
          Waiting for the next quiz question...
        </p>
      </div>
    );
  }

  async function handleAnswer(index: number) {
    if (selected !== null) return;
    setSelected(index);
    try {
      const { data } = await api.post('/api/quiz/answer', {
        question_id: activeQuiz!.id,
        selected_index: index,
      });
      setResult(data);
    } catch {
      // Already answered or error
    }
  }

  return (
    <div className="bg-surface2 rounded-xl border border-white/[0.07] p-4">
      <h3 className="font-syne font-semibold text-sm mb-3">Quiz</h3>
      <p className="text-sm text-white/80 mb-3">{activeQuiz.question}</p>

      <div className="space-y-2">
        {activeQuiz.options.map((opt, i) => {
          let style = 'bg-surface3 border-white/[0.07] hover:border-gold/30';
          if (selected !== null) {
            if (result && i === result.correct_index) {
              style = 'bg-fangreen/10 border-fangreen/50';
            } else if (i === selected && result && !result.is_correct) {
              style = 'bg-fanred/10 border-fanred/50';
            }
          }

          return (
            <button
              key={i}
              onClick={() => handleAnswer(i)}
              disabled={selected !== null}
              className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition ${style} disabled:cursor-default`}
            >
              {opt}
            </button>
          );
        })}
      </div>

      {result && (
        <p className={`mt-3 text-xs font-medium ${result.is_correct ? 'text-fangreen' : 'text-fanred'}`}>
          {result.is_correct
            ? `Correct! +${result.points_earned} points`
            : 'Wrong answer!'}
        </p>
      )}
    </div>
  );
}
