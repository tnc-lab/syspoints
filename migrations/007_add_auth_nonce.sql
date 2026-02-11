-- Migration: add auth nonce to users

ALTER TABLE users
ADD COLUMN auth_nonce TEXT,
ADD COLUMN auth_nonce_expires_at TIMESTAMPTZ;
