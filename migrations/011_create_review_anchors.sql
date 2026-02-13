-- Migration: persist public blockchain tx metadata for reviews

CREATE TABLE review_anchors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL UNIQUE REFERENCES reviews (id) ON DELETE RESTRICT,
    tx_hash TEXT NOT NULL UNIQUE,
    chain_id BIGINT,
    block_number BIGINT,
    block_timestamp TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT review_anchors_tx_hash_format CHECK (tx_hash ~* '^0x[0-9a-f]{64}$'),
    CONSTRAINT review_anchors_chain_id_positive CHECK (chain_id IS NULL OR chain_id > 0),
    CONSTRAINT review_anchors_block_number_non_negative CHECK (block_number IS NULL OR block_number >= 0)
);
