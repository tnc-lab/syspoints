-- Migration: add review title and allow stars range 0..5

ALTER TABLE reviews
ADD COLUMN IF NOT EXISTS title TEXT;

UPDATE reviews
SET title = 'Untitled review'
WHERE title IS NULL OR char_length(trim(title)) = 0;

ALTER TABLE reviews
ALTER COLUMN title SET NOT NULL;

ALTER TABLE reviews
DROP CONSTRAINT IF EXISTS reviews_title_non_empty;

ALTER TABLE reviews
ADD CONSTRAINT reviews_title_non_empty CHECK (char_length(trim(title)) > 0);

ALTER TABLE reviews
DROP CONSTRAINT IF EXISTS reviews_stars_range;

ALTER TABLE reviews
ADD CONSTRAINT reviews_stars_range CHECK (stars BETWEEN 0 AND 5);
