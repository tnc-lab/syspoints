-- Migration: harden review content fields against HTML injection and abusive payloads

CREATE OR REPLACE FUNCTION review_tags_are_safe(tags text[])
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  tag text;
  clean_tag text;
BEGIN
  IF tags IS NULL OR array_length(tags, 1) IS NULL THEN
    RETURN false;
  END IF;

  FOREACH tag IN ARRAY tags LOOP
    clean_tag := btrim(COALESCE(tag, ''));

    IF char_length(clean_tag) < 2 OR char_length(clean_tag) > 30 THEN
      RETURN false;
    END IF;

    IF clean_tag ~* '<[^>]*>' THEN
      RETURN false;
    END IF;

    IF clean_tag ~* '&(?:lt|gt|#x0*3c|#0*60);' THEN
      RETURN false;
    END IF;
  END LOOP;

  RETURN true;
END;
$$;

ALTER TABLE reviews
DROP CONSTRAINT IF EXISTS reviews_title_max_length;

ALTER TABLE reviews
ADD CONSTRAINT reviews_title_max_length CHECK (char_length(trim(title)) <= 120);

ALTER TABLE reviews
DROP CONSTRAINT IF EXISTS reviews_description_max_length;

ALTER TABLE reviews
ADD CONSTRAINT reviews_description_max_length CHECK (char_length(trim(description)) <= 2000);

ALTER TABLE reviews
DROP CONSTRAINT IF EXISTS reviews_title_no_html;

ALTER TABLE reviews
ADD CONSTRAINT reviews_title_no_html CHECK (
  title !~* '<[^>]*>'
  AND title !~* '&(?:lt|gt|#x0*3c|#0*60);'
);

ALTER TABLE reviews
DROP CONSTRAINT IF EXISTS reviews_description_no_html;

ALTER TABLE reviews
ADD CONSTRAINT reviews_description_no_html CHECK (
  description !~* '<[^>]*>'
  AND description !~* '&(?:lt|gt|#x0*3c|#0*60);'
);

ALTER TABLE reviews
DROP CONSTRAINT IF EXISTS reviews_tags_safe;

ALTER TABLE reviews
ADD CONSTRAINT reviews_tags_safe CHECK (review_tags_are_safe(tags));
