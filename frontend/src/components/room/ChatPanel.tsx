import { useState, useRef, useEffect } from 'react';
import { useRoomStore } from '../../store/roomStore';
import { useAuthStore } from '../../store/authStore';

interface ChatPanelProps {
  onSendChat: (message: string) => void;
}

const AVATAR_COLORS = [
  { bg: 'rgba(74,158,255,0.15)', color: 'var(--blue)' },
  { bg: 'rgba(244,185,64,0.12)', color: 'var(--gold)' },
  { bg: 'rgba(61,214,140,0.1)', color: 'var(--green)' },
  { bg: 'rgba(139,111,255,0.1)', color: 'var(--purple)' },
  { bg: 'rgba(240,90,90,0.1)', color: 'var(--red)' },
];

function getAvatarColor(name: string) {
  const idx = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

export function ChatPanel({ onSendChat: _onSendChat }: ChatPanelProps) {
  const messages = useRoomStore((s) => s.messages);
  const user = useAuthStore((s) => s.user);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto" style={{ padding: '14px 18px' }}>
        <div className="flex flex-col gap-3">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <div className="text-2xl mb-3">💬</div>
              <div className="text-[13px] font-medium mb-1" style={{ color: 'var(--tx)' }}>
                No messages yet
              </div>
              <div className="text-[11px]" style={{ color: 'var(--mu)' }}>
                {user ? 'Be the first to say something!' : 'Sign in to start chatting'}
              </div>
            </div>
          )}

          {messages.map((msg) => {
            const isMe = user?.id === msg.user_id;
            const initials = msg.username
              .split(' ')
              .map((n) => n[0])
              .join('')
              .slice(0, 2)
              .toUpperCase();
            const avatarStyle = getAvatarColor(msg.username);

            return (
              <div key={msg.id} className="flex gap-2.5">
                {/* Avatar */}
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                  style={{ background: avatarStyle.bg, color: avatarStyle.color }}
                >
                  {initials}
                </div>

                {/* Body */}
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] mb-0.5" style={{ color: 'var(--mu)' }}>
                    <span style={{ color: isMe ? 'var(--gold)' : 'var(--tx)', fontWeight: 500 }}>
                      {msg.username}
                    </span>
                    {isMe && <span className="text-[9px] ml-1" style={{ color: 'var(--gold)' }}>You</span>}
                    {msg.timestamp && (
                      <span className="ml-1.5">
                        · {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  <div
                    className="text-[13px] leading-[1.5] px-3 py-2 inline-block max-w-full"
                    style={{
                      background: isMe ? 'rgba(244,185,64,0.04)' : 'var(--s1)',
                      border: isMe ? '0.5px solid rgba(244,185,64,0.25)' : '0.5px solid var(--b1)',
                      borderRadius: '0 10px 10px 10px',
                      color: 'var(--tx)',
                      wordBreak: 'break-word',
                    }}
                  >
                    {msg.message}
                  </div>
                </div>
              </div>
            );
          })}
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
    if (!input.trim() || !user) return;
    onSendChat(input.trim());
    setInput('');
  }

  return (
    <div
      className="flex gap-2 shrink-0"
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
        className="flex-1 px-3 py-2 text-[13px] outline-none disabled:opacity-40"
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
