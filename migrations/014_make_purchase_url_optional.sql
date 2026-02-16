-- Migration: make purchase_url optional for reviews

ALTER TABLE reviews
ALTER COLUMN purchase_url DROP NOT NULL;

ALTER TABLE reviews
DROP CONSTRAINT IF EXISTS reviews_purchase_url_non_empty;
