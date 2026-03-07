-- Migration: system modules registry for declarative extensions

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS system_modules (
    module_key TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    version TEXT NOT NULL,
    description TEXT,
    manifest_json JSONB NOT NULL,
    manifest_sha256 TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'inactive',
    execution_order INTEGER NOT NULL DEFAULT 100,
    uploaded_by UUID REFERENCES users (id) ON DELETE SET NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    activated_at TIMESTAMPTZ,
    deactivated_at TIMESTAMPTZ,
    last_error TEXT,
    CONSTRAINT system_modules_status_check CHECK (status IN ('inactive', 'active', 'blocked')),
    CONSTRAINT system_modules_name_non_empty CHECK (char_length(trim(name)) > 0),
    CONSTRAINT system_modules_version_non_empty CHECK (char_length(trim(version)) > 0),
    CONSTRAINT system_modules_sha256_format CHECK (manifest_sha256 ~ '^[a-f0-9]{64}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS system_modules_name_version_unique
    ON system_modules (lower(name), lower(version));

CREATE INDEX IF NOT EXISTS system_modules_status_order_idx
    ON system_modules (status, execution_order ASC, uploaded_at ASC);
