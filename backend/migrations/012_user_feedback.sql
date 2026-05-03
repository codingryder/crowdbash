-- User feedback / issue reports captured from in-room Feedback tab.
-- room_id is nullable so admins can also collect global feedback later;
-- user_id is nullable so anonymous (logged-out) users can submit too.
CREATE TABLE IF NOT EXISTS user_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    username VARCHAR(100),
    contact VARCHAR(200),
    sport VARCHAR(20) NOT NULL DEFAULT 'cricket',
    category VARCHAR(40) NOT NULL DEFAULT 'general',
    severity VARCHAR(20),
    nps INT,
    message TEXT NOT NULL,
    answers JSONB,
    user_agent VARCHAR(400),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_room_created
    ON user_feedback (room_id, created_at);

CREATE INDEX IF NOT EXISTS idx_feedback_category_created
    ON user_feedback (category, created_at);
