CREATE TABLE IF NOT EXISTS device_tokens (
  id         SERIAL      PRIMARY KEY,
  token      TEXT        NOT NULL UNIQUE,
  platform   TEXT        CHECK (platform IN ('ios', 'android', 'web')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS device_tokens_token ON device_tokens (token);
