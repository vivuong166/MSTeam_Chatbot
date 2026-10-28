CREATE TABLE IF NOT EXISTS bot_control_state (
  bot_instance_id TEXT PRIMARY KEY,
  auto_reply BOOLEAN NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
