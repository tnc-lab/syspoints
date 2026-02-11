-- Migration: add default user avatar to Syspoints configuration

ALTER TABLE points_config
ADD COLUMN IF NOT EXISTS default_user_avatar_url TEXT;
