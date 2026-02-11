-- Migration: add image_url to establishments

ALTER TABLE establishments
ADD COLUMN IF NOT EXISTS image_url TEXT;
