-- Migration: add user preference for leaderboard public identity

ALTER TABLE users
ADD COLUMN IF NOT EXISTS leaderboard_display_mode TEXT NOT NULL DEFAULT 'wallet';

UPDATE users
SET leaderboard_display_mode = 'wallet'
WHERE leaderboard_display_mode IS NULL
   OR leaderboard_display_mode NOT IN ('wallet', 'name');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_leaderboard_display_mode_check'
  ) THEN
    ALTER TABLE users
    ADD CONSTRAINT users_leaderboard_display_mode_check
    CHECK (leaderboard_display_mode IN ('wallet', 'name'));
  END IF;
END $$;
