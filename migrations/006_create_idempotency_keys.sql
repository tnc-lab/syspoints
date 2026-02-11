-- Migration: create idempotency keys storage

CREATE TABLE idempotency_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    idempotency_key TEXT NOT NULL,
    response_body JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT idempotency_user_key_unique UNIQUE (user_id, idempotency_key)
);
