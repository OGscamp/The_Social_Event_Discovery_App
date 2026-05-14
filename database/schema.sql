-- Social Event Discovery App - Full Schema
-- Apply via migrations/ folder (Docker auto-runs on fresh init)

CREATE TABLE IF NOT EXISTS users (
  user_id        BIGSERIAL PRIMARY KEY,
  email          VARCHAR(255) UNIQUE NOT NULL,
  display_name   VARCHAR(100) NOT NULL,
  password_hash  TEXT,                          -- nullable: Google OAuth users have no password
  google_id      VARCHAR(255) UNIQUE,           -- set for Google OAuth users
  created_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS events (
  event_id       BIGSERIAL PRIMARY KEY,
  title          VARCHAR(200) NOT NULL,
  description    TEXT,
  location_name  VARCHAR(200),
  start_time     TIMESTAMP NOT NULL,
  end_time       TIMESTAMP,
  created_by     BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  capacity       INTEGER CHECK (capacity > 0)
);

CREATE TABLE IF NOT EXISTS event_attendees (
  event_id   BIGINT NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  user_id    BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  status     VARCHAR(20) NOT NULL DEFAULT 'going',
  joined_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id, user_id)
);

CREATE TABLE IF NOT EXISTS tags (
  tag_id     BIGSERIAL PRIMARY KEY,
  name       VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS event_tags (
  event_id   BIGINT NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  tag_id     BIGINT NOT NULL REFERENCES tags(tag_id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, tag_id)
);
