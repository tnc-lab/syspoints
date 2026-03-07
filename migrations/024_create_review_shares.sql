-- Migration: track review shares and awarded share points

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS review_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL REFERENCES reviews (id) ON DELETE CASCADE,
    shared_by_user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    share_points_awarded INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT review_shares_platform_check CHECK (platform IN ('telegram','x','whatsapp','linkedin','facebook','instagram')),
    CONSTRAINT review_shares_points_non_negative CHECK (share_points_awarded >= 0),
    CONSTRAINT review_shares_unique_per_platform UNIQUE (review_id, shared_by_user_id, platform)
);

CREATE INDEX IF NOT EXISTS review_shares_user_created_idx
    ON review_shares (shared_by_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS review_shares_review_created_idx
    ON review_shares (review_id, created_at DESC);
