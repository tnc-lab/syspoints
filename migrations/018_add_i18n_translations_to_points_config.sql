-- Migration: add i18n translations JSON to Syspoints configuration

ALTER TABLE points_config
ADD COLUMN IF NOT EXISTS i18n_translations_json TEXT;
