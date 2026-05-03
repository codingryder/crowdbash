import { useState } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';

interface FeedbackPanelProps {
  roomId?: string;
  context?: 'room' | 'site';
}

type Category =
  | 'general'
  | 'joining'
  | 'team_building'
  | 'power_allocation'
  | 'edit_window'
  | 'scorecard'
  | 'playing_xi'
  | 'quiz'
  | 'leaderboard'
  | 'chat'
  | 'rewards'
  | 'performance'
  | 'bug';

const CATEGORIES: { key: Category; label: string; hint: string }[] = [
  { key: 'general', label: 'General', hint: "Anything that doesn't fit the buckets below." },
  { key: 'joining', label: 'Joining a room', hint: 'Room codes, invites, login flow.' },
  { key: 'team_building', label: 'Team building', hint: 'Squad selection, role caps, player info.' },
  { key: 'power_allocation', label: 'Power allocation', hint: '33-point system, sliders, presets.' },
  { key: 'edit_window', label: 'Reshuffle / edit windows', hint: 'Mid-match power reshuffle and player edits.' },
  { key: 'scorecard', label: 'Live scorecard & commentary', hint: 'Score accuracy, lag, commentary feed.' },
  { key: 'playing_xi', label: 'Playing XI banner', hint: 'Did the announced XI show up on time?' },
  { key: 'quiz', label: 'Quiz / live polls', hint: 'Question quality, timer, scoring.' },
  { key: 'leaderboard', label: 'Leaderboard & scoring', hint: 'Ranks, point breakdowns, accuracy.' },
  { key: 'chat', label: 'Chat', hint: 'Reactions, replies, abuse, missing features.' },
  { key: 'rewards', label: 'Rewards / Bashpoints', hint: 'Coin earning, redemption, payouts.' },
  { key: 'performance', label: 'Performance / reliability', hint: 'Slow loads, disconnects, crashes.' },
  { key: 'bug', label: 'Bug report', hint: 'Something is clearly broken.' },
];

const SEVERITIES = [
  { key: 'low', label: 'Low — minor annoyance' },
  { key: 'medium', label: 'Medium — affects my experience' },
  { key: 'high', label: 'High — blocks me from playing' },
  { key: 'critical', label: 'Critical — lost data / coins / points' },
] as const;

const RATING_QUESTIONS: { key: string; label: string }[] = [
  { key: 'rate_join', label: 'How easy was it to find and join this room?' },
  { key: 'rate_team_building', label: 'How clear were the role caps when picking your XI?' },
  { key: 'rate_power', label: 'How well do you understand the 33-point power system?' },
  { key: 'rate_score_accuracy', label: 'How accurate / live did the score feel?' },
  { key: 'rate_quiz', label: 'How fun were the in-room quiz questions?' },
  { key: 'rate_leaderboard', label: 'How clear is why you are ranked where you are?' },
  { key: 'rate_chat', label: 'How well does the chat work for you?' },
  { key: 'rate_rewards', label: 'How clear are coins / Bashpoints earning + spending?' },
];

export function FeedbackPanel({ roomId, context = 'room' }: FeedbackPanelProps) {
  const { user, openAuthModal } = useAuth();
  const [category, setCategory] = useState<Category>('general');
  const [severity, setSeverity] = useState<string>('');
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState('');
  const [nps, setNps] = useState<number | null>(null);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [topAdd, setTopAdd] = useState('');
  const [topRemove, setTopRemove] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const messageMin = 5;
  const messageOk = message.trim().length >= messageMin;

  function setRating(key: string, value: number) {
    setRatings((prev) => ({ ...prev, [key]: value }));
  }

  function reset() {
    setCategory('general');
    setSeverity('');
    setMessage('');
    setContact('');
    setNps(null);
    setRatings({});
    setTopAdd('');
    setTopRemove('');
    setSubmitted(false);
  }

  async function handleSubmit() {
    if (!messageOk || submitting) return;
    setSubmitting(true);
    try {
      const answers: Record<string, unknown> = {
        ratings,
        nps,
        top_feature_to_add: topAdd.trim() || null,
        top_thing_to_remove: topRemove.trim() || null,
        context,
      };
      await api.post('/api/feedback/submit', {
        room_id: roomId ?? null,
        sport: 'cricket',
        category,
        severity: severity || null,
        nps: nps,
        message: message.trim(),
        contact: contact.trim() || null,
        answers,
      });
      setToast('Thanks! Your feedback was sent.');
      setSubmitted(true);
      setTimeout(() => setToast(null), 3500);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setToast(err?.response?.data?.detail || 'Could not send feedback. Try again.');
      setTimeout(() => setToast(null), 3500);
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center text-center" style={{ padding: '40px 24px', minHeight: 320 }}>
        <div style={{ fontSize: 36 }}>🙌</div>
        <div className="mt-3" style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 18, fontWeight: 900 }}>
          Feedback received
        </div>
        <div className="text-[12px] mt-1.5 max-w-sm" style={{ color: 'var(--muted)' }}>
          We read every single one. If we have a follow-up we'll reach out using the contact you shared.
        </div>
        <button onClick={reset} className="btn btn-ghost mt-5" style={{ fontSize: 12, padding: '8px 18px' }}>
          Send another
        </button>
        {toast && <FeedbackToast message={toast} />}
      </div>
    );
  }

  return (
    <div style={{ padding: '20px 24px' }}>
      <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 18, fontWeight: 900, marginBottom: 4 }}>
        {context === 'site' ? 'Send us feedback' : 'Help us improve cricket rooms'}
      </div>
      <div className="text-[12px] mb-5" style={{ color: 'var(--muted)' }}>
        {context === 'site'
          ? 'Cricket-room feedback for now — ratings and questions are optional. Only the message is required.'
          : "Tell us what's working, what's broken, and what you'd love to see in cricket game rooms. All ratings are optional — only the message is required."}
      </div>

      {!user && (
        <div className="rounded-xl text-center py-4 px-4 mb-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="text-[12px] mb-2" style={{ color: 'var(--muted)' }}>
            You can submit feedback as a guest. Sign in if you'd like us to follow up.
          </div>
          <button onClick={openAuthModal} className="btn btn-ghost" style={{ padding: '6px 16px', fontSize: 12 }}>
            Sign in
          </button>
        </div>
      )}

      {/* Category */}
      <Section title="What's this about?">
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => {
            const active = category === c.key;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => setCategory(c.key)}
                className="text-[12px]"
                style={{
                  padding: '7px 12px',
                  borderRadius: 999,
                  border: active ? '1px solid var(--green)' : '1px solid var(--border)',
                  background: active ? 'rgba(45,214,122,0.12)' : 'var(--surface)',
                  color: active ? 'var(--green)' : 'var(--text)',
                  fontWeight: active ? 700 : 500,
                  cursor: 'pointer',
                }}
              >
                {c.label}
              </button>
            );
          })}
        </div>
        <div className="text-[11px] mt-2" style={{ color: 'var(--muted)' }}>
          {CATEGORIES.find((c) => c.key === category)?.hint}
        </div>
      </Section>

      {/* Severity (only when bug/performance) */}
      {(category === 'bug' || category === 'performance') && (
        <Section title="How serious is it?">
          <div className="flex flex-col gap-2">
            {SEVERITIES.map((s) => (
              <label key={s.key} className="flex items-center gap-2 text-[12px] cursor-pointer">
                <input
                  type="radio"
                  name="severity"
                  checked={severity === s.key}
                  onChange={() => setSeverity(s.key)}
                  style={{ accentColor: 'var(--green)' }}
                />
                <span>{s.label}</span>
              </label>
            ))}
          </div>
        </Section>
      )}

      {/* Message */}
      <Section title="Tell us what happened" required>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Be as specific as you can — what you did, what you expected, what actually happened. Include the over / minute if it's about live data."
          rows={5}
          maxLength={4000}
          className="w-full text-[13px] outline-none"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            color: 'var(--text)',
            padding: '10px 12px',
            resize: 'vertical',
            fontFamily: "'DM Sans', sans-serif",
            lineHeight: 1.5,
          }}
        />
        <div className="flex items-center justify-between mt-1">
          <div className="text-[11px]" style={{ color: messageOk ? 'var(--muted)' : 'var(--amber)' }}>
            {messageOk ? `${message.trim().length} chars` : `${messageMin - message.trim().length} more chars needed`}
          </div>
          <div className="text-[11px]" style={{ color: 'var(--muted)' }}>
            {message.length}/4000
          </div>
        </div>
      </Section>

      {/* Quick ratings */}
      <Section title="Rate the cricket-room features (optional)">
        <div className="flex flex-col gap-3">
          {RATING_QUESTIONS.map((q) => (
            <RatingRow
              key={q.key}
              label={q.label}
              value={ratings[q.key]}
              onChange={(v) => setRating(q.key, v)}
            />
          ))}
        </div>
      </Section>

      {/* Open-ended */}
      <Section title="One feature you'd add to cricket rooms (optional)">
        <input
          type="text"
          value={topAdd}
          onChange={(e) => setTopAdd(e.target.value)}
          placeholder="e.g. captain / vice-captain multipliers"
          maxLength={200}
          className="w-full text-[13px] outline-none"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            color: 'var(--text)',
            padding: '10px 12px',
            fontFamily: "'DM Sans', sans-serif",
          }}
        />
      </Section>

      <Section title="One thing you'd remove or simplify (optional)">
        <input
          type="text"
          value={topRemove}
          onChange={(e) => setTopRemove(e.target.value)}
          placeholder="e.g. too many tabs on mobile"
          maxLength={200}
          className="w-full text-[13px] outline-none"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            color: 'var(--text)',
            padding: '10px 12px',
            fontFamily: "'DM Sans', sans-serif",
          }}
        />
      </Section>

      {/* NPS */}
      <Section title="How likely are you to recommend Crowdbash cricket rooms? (0–10, optional)">
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: 11 }, (_, i) => i).map((n) => {
            const active = nps === n;
            const color = n <= 6 ? 'var(--red)' : n <= 8 ? 'var(--amber)' : 'var(--green)';
            return (
              <button
                key={n}
                type="button"
                onClick={() => setNps(active ? null : n)}
                className="text-[12px] font-bold"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: active ? `1px solid ${color}` : '1px solid var(--border)',
                  background: active ? color : 'var(--surface)',
                  color: active ? '#0b0f12' : 'var(--text)',
                  cursor: 'pointer',
                  fontFamily: "'Cabinet Grotesk', sans-serif",
                }}
              >
                {n}
              </button>
            );
          })}
        </div>
        <div className="flex justify-between text-[10px] mt-1" style={{ color: 'var(--muted)' }}>
          <span>Not likely</span>
          <span>Very likely</span>
        </div>
      </Section>

      {/* Contact */}
      <Section title="Email or phone for follow-up (optional)">
        <input
          type="text"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder={user?.email || 'name@example.com or +91 …'}
          maxLength={200}
          className="w-full text-[13px] outline-none"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            color: 'var(--text)',
            padding: '10px 12px',
            fontFamily: "'DM Sans', sans-serif",
          }}
        />
      </Section>

      <div className="flex items-center justify-end gap-2 mt-4">
        <button
          type="button"
          onClick={reset}
          className="btn btn-ghost"
          style={{ fontSize: 12, padding: '8px 16px' }}
          disabled={submitting}
        >
          Reset
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!messageOk || submitting}
          className="btn"
          style={{
            fontSize: 12,
            padding: '8px 18px',
            background: 'var(--green)',
            color: '#071a0e',
            fontWeight: 800,
            opacity: !messageOk || submitting ? 0.5 : 1,
            cursor: !messageOk || submitting ? 'not-allowed' : 'pointer',
          }}
        >
          {submitting ? 'Sending…' : 'Send feedback'}
        </button>
      </div>

      {toast && <FeedbackToast message={toast} />}
    </div>
  );
}

function Section({
  title,
  required,
  children,
}: {
  title: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl p-4 mb-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="text-[10px] uppercase tracking-[1.5px] mb-3" style={{ color: 'var(--muted)' }}>
        {title}
        {required && <span style={{ color: 'var(--red)', marginLeft: 4 }}>*</span>}
      </div>
      {children}
    </div>
  );
}

function RatingRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="text-[12px] mb-1.5" style={{ color: 'var(--text)' }}>{label}</div>
      <div className="flex items-center gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => {
          const active = value !== undefined && n <= value;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              aria-label={`Rate ${n} of 5`}
              className="text-[16px]"
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: active ? 'rgba(244,185,64,0.12)' : 'var(--surface2)',
                color: active ? 'var(--amber)' : 'var(--muted)',
                cursor: 'pointer',
                lineHeight: 1,
              }}
            >
              {active ? '★' : '☆'}
            </button>
          );
        })}
        {value !== undefined && (
          <button
            type="button"
            onClick={() => onChange(0)}
            className="text-[10px] ml-2"
            style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}
          >
            clear
          </button>
        )}
      </div>
    </div>
  );
}

function FeedbackToast({ message }: { message: string }) {
  return (
    <div
      className="fixed bottom-6 left-1/2 z-[1100] rounded-lg px-4 py-2.5 max-w-md"
      style={{
        transform: 'translateX(-50%)',
        background: 'rgba(45,214,122,0.18)',
        border: '1px solid rgba(45,214,122,0.4)',
        color: 'var(--green)',
        fontSize: 13,
        fontWeight: 700,
      }}
    >
      {message}
    </div>
  );
}
