-- Migration: add configurable business rules to points configuration

ALTER TABLE points_config
ADD COLUMN IF NOT EXISTS max_reviews_per_establishment_per_day INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS max_review_tags INTEGER NOT NULL DEFAULT 5,
ADD COLUMN IF NOT EXISTS search_saved_establishments_enabled BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS allow_global_category_search BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS require_profile_completion BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE points_config
SET
  max_reviews_per_establishment_per_day = COALESCE(max_reviews_per_establishment_per_day, 1),
  max_review_tags = COALESCE(max_review_tags, 5),
  search_saved_establishments_enabled = COALESCE(search_saved_establishments_enabled, TRUE),
  allow_global_category_search = COALESCE(allow_global_category_search, TRUE),
  require_profile_completion = COALESCE(require_profile_completion, FALSE);
