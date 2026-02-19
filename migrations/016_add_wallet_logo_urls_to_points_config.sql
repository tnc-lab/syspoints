-- Migration: add configurable wallet logos to points configuration

ALTER TABLE points_config
ADD COLUMN IF NOT EXISTS metamask_wallet_logo_url TEXT,
ADD COLUMN IF NOT EXISTS pali_wallet_logo_url TEXT,
ADD COLUMN IF NOT EXISTS other_wallet_logo_url TEXT;
