import { useState, useRef, useEffect } from 'react';
import { useRoomStore } from '../../store/roomStore';
import { useAuthStore } from '../../store/authStore';

interface ChatPanelProps {
  onSendChat: (_message: string) => void;
}

// Sample chat messages for mockup display
const SAMPLE_MESSAGES = [
  { id: '1', initials: 'RK', color: 'var(--blue)', bg: 'rgba(74,158,255,0.15)', name: 'Rakesh_K', over: '48.3', message: 'Put all 3 weightage on Kohli from over 1 and never looked back', highlight: true, reactions: [{ emoji: '🔥', count: 24 }, { emoji: '💪', count: 11 }] },
  { id: '2', initials: 'SM', color: 'var(--green)', bg: 'rgba(61,214,140,0.1)', name: 'SachinM99', over: '48.1', message: "That Kohli cover drive at 48.1 is why he's GOAT. No debate.", highlight: false, reactions: [{ emoji: '👑', count: 42 }] },
  { id: '3', initials: 'AP', color: 'var(--red)', bg: 'rgba(240,90,90,0.1)', name: 'AussiePhil_7', over: '47.6', message: "Sharma wicket let's goooo!! AUS will chase this", highlight: false, reactions: [{ emoji: '😂', count: 18 }, { emoji: '🙏', count: 7 }] },
  { id: '4', initials: 'NK', color: 'var(--purple)', bg: 'rgba(139,111,255,0.1)', name: 'NitinK', over: '47.4', message: "Made a big mistake giving Bumrah 3 weightage. Bowler doesn't bat! Switching to Gill next edit window!", highlight: false, reactions: [{ emoji: '😅', count: 31 }] },
  { id: '5', initials: 'DM', color: 'var(--gold)', bg: 'rgba(244,185,64,0.1)', name: 'DhoniMagic', over: '47.1', message: "290+ easily. Kohli doesn't miss in death overs.", highlight: false, reactions: [{ emoji: '✅', count: 15 }] },
];

export function ChatPanel({ onSendChat: _onSendChat }: ChatPanelProps) {
  const messages = useRoomStore((s) => s.messages);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Show sample data when no real messages
  const showSample = messages.length === 0;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto" style={{ padding: '14px 18px' }}>
        <div className="flex flex-col gap-3">
          {showSample
            ? SAMPLE_MESSAGES.map((msg) => (
                <div key={msg.id} className="flex gap-2.5">
                  {/* Avatar */}
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                    style={{ background: msg.bg, color: msg.color }}
                  >
                    {msg.initials}
                  </div>

                  {/* Body */}
                  <div>
                    <div className="text-[11px] mb-0.5" style={{ color: 'var(--mu)' }}>
                      <span style={{ color: 'var(--tx)', fontWeight: 500 }}>{msg.name}</span>
                      {' '}&middot; {msg.over}
                    </div>
                    <div
                      className="text-[13px] leading-[1.5] px-3 py-2"
                      style={{
                        background: msg.highlight ? 'rgba(244,185,64,0.04)' : 'var(--s1)',
                        border: msg.highlight
                          ? '0.5px solid rgba(244,185,64,0.25)'
                          : '0.5px solid var(--b1)',
                        borderRadius: '0 10px 10px 10px',
                        color: 'var(--tx)',
                      }}
                    >
                      {msg.message}
                    </div>
                    {/* Reactions */}
                    <div className="flex gap-1.5 mt-1">
                      {msg.reactions.map((r, ri) => (
                        <span
                          key={ri}
                          className="text-[11px] px-2 py-0.5 rounded-[20px] cursor-pointer"
                          style={{
                            background: 'var(--s2)',
                            border: '0.5px solid var(--b1)',
                          }}
                        >
                          {r.emoji} {r.count}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))
            : messages.map((msg) => (
                <div key={msg.id} className="flex gap-2.5">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                    style={{ background: 'rgba(139,111,255,0.1)', color: 'var(--purple)' }}
                  >
                    {msg.username.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-[11px] mb-0.5" style={{ color: 'var(--mu)' }}>
                      <span style={{ color: 'var(--tx)', fontWeight: 500 }}>{msg.username}</span>
                    </div>
                    <div
                      className="text-[13px] leading-[1.5] px-3 py-2"
                      style={{
                        background: 'var(--s1)',
                        border: '0.5px solid var(--b1)',
                        borderRadius: '0 10px 10px 10px',
                        color: 'var(--tx)',
                      }}
                    >
                      {msg.message}
                    </div>
                  </div>
                </div>
              ))}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}

export function ChatInput({ onSendChat }: { onSendChat: (msg: string) => void }) {
  const user = useAuthStore((s) => s.user);
  const [input, setInput] = useState('');

  function handleSend() {
    if (!input.trim()) return;
    onSendChat(input.trim());
    setInput('');
  }

  return (
    <div
      className="flex gap-2"
      style={{
        borderTop: '0.5px solid var(--b1)',
        padding: '10px 18px',
        background: 'var(--bg)',
      }}
    >
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        placeholder={user ? 'Type a message...' : 'Sign in to chat'}
        disabled={!user}
        className="flex-1 px-3 py-2 text-[13px] outline-none"
        style={{
          background: 'var(--s1)',
          border: '0.5px solid var(--b2)',
          borderRadius: 8,
          color: 'var(--tx)',
          fontFamily: "'DM Sans', sans-serif",
        }}
      />
      <button
        onClick={handleSend}
        disabled={!user || !input.trim()}
        className="px-4 text-[13px] font-bold cursor-pointer font-syne border-none disabled:opacity-30"
        style={{
          background: 'var(--gold)',
          borderRadius: 8,
          color: '#09090F',
        }}
      >
        Send
      </button>
    </div>
  );
}
