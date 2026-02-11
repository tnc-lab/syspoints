-- Migration: add role to users

ALTER TABLE users
ADD COLUMN role TEXT NOT NULL DEFAULT 'user';

COMMENT ON COLUMN users.role IS 'user or admin';
