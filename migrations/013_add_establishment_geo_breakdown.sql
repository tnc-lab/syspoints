-- Migration: add geo breakdown fields to establishments

ALTER TABLE establishments
ADD COLUMN IF NOT EXISTS country TEXT;

ALTER TABLE establishments
ADD COLUMN IF NOT EXISTS state_region TEXT;

ALTER TABLE establishments
ADD COLUMN IF NOT EXISTS district TEXT;
