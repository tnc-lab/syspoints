-- Migration: create users table

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT NOT NULL,
    email TEXT,
    name TEXT NOT NULL,
    avatar_url TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT users_wallet_or_email CHECK (
        (wallet_address IS NOT NULL AND length(trim(wallet_address)) > 0)
        OR (email IS NOT NULL AND length(trim(email)) > 0)
    )
);

CREATE UNIQUE INDEX users_wallet_address_key ON users (wallet_address);
CREATE UNIQUE INDEX users_email_key ON users (email);
