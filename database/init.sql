-- Solemtrix – Neon PostgreSQL schema
-- Run this once against your Neon database.
-- After running, the FastAPI backend will work without needing SQLAlchemy auto-create.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Users ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT        UNIQUE NOT NULL,
    hashed_password TEXT        NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Canes ──────────────────────────────────────────────────────────────────
-- id = the QR code payload string (e.g. "cane_abc123")

CREATE TABLE IF NOT EXISTS canes (
    id         TEXT        PRIMARY KEY,
    name       TEXT        NOT NULL DEFAULT 'Baston',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Cane Access (many caregivers ↔ many canes) ─────────────────────────────

CREATE TABLE IF NOT EXISTS cane_access (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    caregiver_id UUID        NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
    cane_id      TEXT        NOT NULL REFERENCES canes(id)  ON DELETE CASCADE,
    linked_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (caregiver_id, cane_id)
);

CREATE INDEX IF NOT EXISTS idx_cane_access_caregiver ON cane_access(caregiver_id);
CREATE INDEX IF NOT EXISTS idx_cane_access_cane      ON cane_access(cane_id);

-- ─── Latest Locations (one row per cane, upserted on each update) ────────────

CREATE TABLE IF NOT EXISTS latest_locations (
    cane_id     TEXT             PRIMARY KEY REFERENCES canes(id) ON DELETE CASCADE,
    latitude    DOUBLE PRECISION NOT NULL,
    longitude   DOUBLE PRECISION NOT NULL,
    accuracy    DOUBLE PRECISION,
    recorded_at TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    source      TEXT             NOT NULL DEFAULT 'unknown'
);

-- ─── Location History (append-only, used for future route replay) ───────────

CREATE TABLE IF NOT EXISTS location_history (
    id          UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
    cane_id     TEXT             NOT NULL REFERENCES canes(id) ON DELETE CASCADE,
    latitude    DOUBLE PRECISION NOT NULL,
    longitude   DOUBLE PRECISION NOT NULL,
    accuracy    DOUBLE PRECISION,
    recorded_at TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    source      TEXT             NOT NULL DEFAULT 'unknown'
);

CREATE INDEX IF NOT EXISTS idx_location_history_cane_time
    ON location_history(cane_id, recorded_at DESC);
