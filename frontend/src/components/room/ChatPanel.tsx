import { useState, useRef, useEffect } from 'react';
import { useRoomStore } from '../../store/roomStore';
import { useAuthStore } from '../../store/authStore';
import { Avatar } from '../ui/Avatar';

interface ChatPanelProps {
  onSendChat: (message: string) => void;
}

export function ChatPanel({ onSendChat }: ChatPanelProps) {
  const messages = useRoomStore((s) => s.messages);
  const user = useAuthStore((s) => s.user);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleSend() {
    if (!input.trim() || !user) return;
    onSendChat(input.trim());
    setInput('');
  }

  return (
    <div className="bg-surface2 rounded-xl border border-white/[0.07] flex flex-col">
      <div className="px-4 py-3 border-b border-white/[0.07]">
        <h3 className="font-syne font-semibold text-sm">Fan Chat</h3>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto max-h-72 p-3 space-y-3">
        {messages.length === 0 && (
          <p className="text-xs text-white/30 text-center py-8">
            No messages yet. Be the first to chat!
          </p>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className="flex items-start gap-2">
            <Avatar username={msg.username} size="sm" />
            <div>
              <p className="text-xs text-gold font-medium">{msg.username}</p>
              <p className="text-sm text-white/80">{msg.message}</p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-white/[0.07]">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={user ? 'Type a message...' : 'Sign in to chat'}
            disabled={!user}
            className="flex-1 bg-surface3 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 border border-white/[0.07] focus:outline-none focus:border-gold/50 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!user || !input.trim()}
            className="px-4 py-2 bg-gold text-bg text-sm font-semibold rounded-lg hover:bg-gold/90 transition disabled:opacity-30"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
