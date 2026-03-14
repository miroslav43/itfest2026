-- Migration 002 — Roles & Destinations
-- Run once against your Neon database after init.sql

-- ─── Add role to users ────────────────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS
  role TEXT NOT NULL DEFAULT 'caregiver';

-- First user registered becomes admin
UPDATE users SET role = 'admin'
WHERE created_at = (SELECT MIN(created_at) FROM users);

-- ─── Destinations (set by blind users, target locations for guidance) ─────────
CREATE TABLE IF NOT EXISTS destinations (
  id            UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  blind_user_id UUID             NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cane_id       TEXT             NOT NULL REFERENCES canes(id) ON DELETE CASCADE,
  name          TEXT             NOT NULL,
  latitude      DOUBLE PRECISION NOT NULL,
  longitude     DOUBLE PRECISION NOT NULL,
  active        BOOLEAN          NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_destinations_blind_user
  ON destinations(blind_user_id);

-- ─── Link blind_user to their cane (created by caregiver) ────────────────────
CREATE TABLE IF NOT EXISTS blind_user_cane (
  blind_user_id UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cane_id       TEXT        NOT NULL REFERENCES canes(id) ON DELETE CASCADE,
  linked_by     UUID        NOT NULL REFERENCES users(id),
  linked_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (blind_user_id, cane_id)
);
