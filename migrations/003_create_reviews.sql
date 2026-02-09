-- Migration: create review and review_evidence tables with constraints and immutability

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    establishment_id UUID NOT NULL REFERENCES establishments (id) ON DELETE RESTRICT,
    description TEXT NOT NULL,
    stars SMALLINT NOT NULL,
    price NUMERIC(12, 2) NOT NULL,
    purchase_url TEXT NOT NULL,
    tags TEXT[] NOT NULL,
    points_awarded INTEGER NOT NULL DEFAULT 0,
    review_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT reviews_description_min_length CHECK (char_length(description) >= 1),
    CONSTRAINT reviews_stars_range CHECK (stars BETWEEN 1 AND 5),
    CONSTRAINT reviews_price_non_negative CHECK (price > 0),
    CONSTRAINT reviews_purchase_url_non_empty CHECK (char_length(trim(purchase_url)) > 0),
    CONSTRAINT reviews_points_non_negative CHECK (points_awarded >= 0),
    CONSTRAINT reviews_tags_non_empty CHECK (array_length(tags, 1) > 0)
);

COMMENT ON CONSTRAINT reviews_description_min_length ON reviews IS
    'Ensures reviews include a non-empty description.';
COMMENT ON CONSTRAINT reviews_stars_range ON reviews IS
    'Ensures review stars are within the 1-5 range.';
COMMENT ON CONSTRAINT reviews_price_non_negative ON reviews IS
    'Ensures review price is greater than 0.';
COMMENT ON CONSTRAINT reviews_purchase_url_non_empty ON reviews IS
    'Ensures purchase URL is provided for the review.';
COMMENT ON CONSTRAINT reviews_points_non_negative ON reviews IS
    'Ensures awarded points cannot be negative.';
COMMENT ON CONSTRAINT reviews_tags_non_empty ON reviews IS
    'Ensures reviews include at least one tag.';

CREATE UNIQUE INDEX reviews_review_hash_key ON reviews (review_hash);

CREATE TABLE review_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL REFERENCES reviews (id) ON DELETE RESTRICT,
    image_url TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT review_evidence_url_non_empty CHECK (char_length(trim(image_url)) > 0)
);

COMMENT ON CONSTRAINT review_evidence_url_non_empty ON review_evidence IS
    'Ensures evidence entries include a non-empty URL.';

CREATE OR REPLACE FUNCTION prevent_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'Immutable table: % operations are not allowed.', TG_OP;
END;
$$;

CREATE TRIGGER reviews_immutable
BEFORE UPDATE OR DELETE ON reviews
FOR EACH ROW
EXECUTE FUNCTION prevent_mutation();

CREATE TRIGGER review_evidence_immutable
BEFORE UPDATE OR DELETE ON review_evidence
FOR EACH ROW
EXECUTE FUNCTION prevent_mutation();

CREATE OR REPLACE FUNCTION enforce_review_has_evidence()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM review_evidence
        WHERE review_id = NEW.id
    ) THEN
        RAISE EXCEPTION 'Review % must have at least one evidence record.', NEW.id;
    END IF;
    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER reviews_require_evidence
AFTER INSERT ON reviews
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION enforce_review_has_evidence();
