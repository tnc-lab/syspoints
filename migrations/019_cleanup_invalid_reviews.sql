-- Migration: remove legacy reviews that do not comply with current security/validation rules

BEGIN;

CREATE OR REPLACE FUNCTION review_text_has_unsafe_content(value text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  clean_value text;
BEGIN
  clean_value := btrim(COALESCE(value, ''));

  IF clean_value = '' THEN
    RETURN false;
  END IF;

  -- HTML/script-like payloads
  IF clean_value ~* '<[^>]*>'
     OR clean_value ~* '&(?:lt|gt|#x0*3c|#0*60);'
     OR clean_value ~* '\m(?:javascript|vbscript)\M\s*:'
     OR clean_value ~* '\mdata\M\s*:\s*text/html'
  THEN
    RETURN true;
  END IF;

  -- Emoji ranges commonly abused in user-generated text.
  IF clean_value ~ '[🌀-🫿☀-➿]' THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

LOCK TABLE reviews IN ACCESS EXCLUSIVE MODE;
LOCK TABLE review_evidence IN ACCESS EXCLUSIVE MODE;
LOCK TABLE review_anchors IN ACCESS EXCLUSIVE MODE;

-- Tables are intentionally immutable via triggers. Temporarily disable them only for this cleanup.
ALTER TABLE reviews DISABLE TRIGGER reviews_immutable;
ALTER TABLE review_evidence DISABLE TRIGGER review_evidence_immutable;

WITH invalid_reviews AS (
  SELECT r.id
  FROM reviews r
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*)::int AS evidence_count,
      BOOL_OR(
        btrim(COALESCE(re.image_url, '')) = ''
        OR btrim(COALESCE(re.image_url, '')) !~* '^https?://'
      ) AS has_invalid_evidence
    FROM review_evidence re
    WHERE re.review_id = r.id
  ) ev ON TRUE
  WHERE
    btrim(COALESCE(r.title, '')) = ''
    OR char_length(btrim(COALESCE(r.title, ''))) > 120
    OR review_text_has_unsafe_content(r.title)
    OR btrim(COALESCE(r.description, '')) = ''
    OR char_length(btrim(COALESCE(r.description, ''))) > 2000
    OR review_text_has_unsafe_content(r.description)
    OR NOT (r.stars BETWEEN 0 AND 5)
    OR r.price <= 0
    OR (
      r.purchase_url IS NOT NULL
      AND btrim(r.purchase_url) <> ''
      AND btrim(r.purchase_url) !~* '^https?://'
    )
    OR r.tags IS NULL
    OR array_length(r.tags, 1) IS NULL
    OR NOT review_tags_are_safe(r.tags)
    OR EXISTS (
      SELECT 1
      FROM unnest(r.tags) AS t(tag)
      WHERE review_text_has_unsafe_content(t.tag)
    )
    OR COALESCE(ev.evidence_count, 0) < 1
    OR COALESCE(ev.evidence_count, 0) > 3
    OR COALESCE(ev.has_invalid_evidence, FALSE)
), deleted_anchors AS (
  DELETE FROM review_anchors ra
  USING invalid_reviews ir
  WHERE ra.review_id = ir.id
  RETURNING ra.review_id
), deleted_evidence AS (
  DELETE FROM review_evidence re
  USING invalid_reviews ir
  WHERE re.review_id = ir.id
  RETURNING re.review_id
), deleted_reviews AS (
  DELETE FROM reviews r
  USING invalid_reviews ir
  WHERE r.id = ir.id
  RETURNING r.id
)
SELECT
  (SELECT COUNT(*) FROM invalid_reviews) AS invalid_reviews_found,
  (SELECT COUNT(*) FROM deleted_anchors) AS anchors_deleted,
  (SELECT COUNT(*) FROM deleted_evidence) AS evidence_deleted,
  (SELECT COUNT(*) FROM deleted_reviews) AS reviews_deleted;

ALTER TABLE review_evidence ENABLE TRIGGER review_evidence_immutable;
ALTER TABLE reviews ENABLE TRIGGER reviews_immutable;

COMMIT;
