-- Migration: introduce off-chain review submissions with moderation states

CREATE TABLE IF NOT EXISTS review_submissions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    establishment_id UUID NOT NULL REFERENCES establishments (id) ON DELETE RESTRICT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    stars SMALLINT NOT NULL,
    price NUMERIC(12, 2) NOT NULL,
    purchase_url TEXT,
    tags TEXT[] NOT NULL,
    evidence_images TEXT[] NOT NULL,
    review_hash TEXT NOT NULL UNIQUE,
    review_timestamp TIMESTAMPTZ NOT NULL,
    signer_wallet TEXT NOT NULL,
    signature TEXT NOT NULL,
    signature_nonce TEXT NOT NULL,
    signature_deadline TIMESTAMPTZ NOT NULL,
    moderation_status TEXT NOT NULL DEFAULT 'pending',
    moderation_reason TEXT,
    moderated_by UUID REFERENCES users (id) ON DELETE SET NULL,
    moderated_at TIMESTAMPTZ,
    approved_review_id UUID UNIQUE REFERENCES reviews (id) ON DELETE SET NULL,
    approval_tx_hash TEXT,
    approval_chain_id BIGINT,
    approval_block_number BIGINT,
    approval_block_timestamp TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT review_submissions_status_check CHECK (moderation_status IN ('pending', 'approved', 'rejected')),
    CONSTRAINT review_submissions_title_non_empty CHECK (char_length(trim(title)) > 0),
    CONSTRAINT review_submissions_description_non_empty CHECK (char_length(trim(description)) > 0),
    CONSTRAINT review_submissions_stars_range CHECK (stars BETWEEN 0 AND 5),
    CONSTRAINT review_submissions_price_positive CHECK (price > 0),
    CONSTRAINT review_submissions_tags_non_empty CHECK (array_length(tags, 1) > 0),
    CONSTRAINT review_submissions_evidence_count CHECK (array_length(evidence_images, 1) BETWEEN 1 AND 3),
    CONSTRAINT review_submissions_signature_non_empty CHECK (char_length(trim(signature)) > 0),
    CONSTRAINT review_submissions_signer_wallet_non_empty CHECK (char_length(trim(signer_wallet)) > 0)
);

CREATE INDEX IF NOT EXISTS review_submissions_user_created_idx
    ON review_submissions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS review_submissions_status_created_idx
    ON review_submissions (moderation_status, created_at ASC);

CREATE UNIQUE INDEX IF NOT EXISTS review_submissions_nonce_unique
    ON review_submissions (user_id, signature_nonce);

CREATE OR REPLACE FUNCTION touch_review_submission_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS review_submissions_touch_updated_at ON review_submissions;
CREATE TRIGGER review_submissions_touch_updated_at
BEFORE UPDATE ON review_submissions
FOR EACH ROW
EXECUTE FUNCTION touch_review_submission_updated_at();
