-- Migration: add share points bonus configuration

ALTER TABLE points_config
  ADD COLUMN IF NOT EXISTS share_points_bonus INTEGER NOT NULL DEFAULT 0;

ALTER TABLE points_config
  DROP CONSTRAINT IF EXISTS points_config_share_points_bonus_check;

ALTER TABLE points_config
  ADD CONSTRAINT points_config_share_points_bonus_check CHECK (share_points_bonus >= 0);
