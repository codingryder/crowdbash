-- Persist room chat so users see history when they (re)open the chat tab.
-- Messages stay until the room is closed (cleanup handled at app level).
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    username VARCHAR(100) NOT NULL DEFAULT 'Anonymous',
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_room_created
    ON chat_messages (room_id, created_at);
