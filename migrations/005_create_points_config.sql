-- Migration: create points configuration table

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE points_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_points_yes INTEGER NOT NULL,
    image_points_no INTEGER NOT NULL,
    description_points_gt_200 INTEGER NOT NULL,
    description_points_lte_200 INTEGER NOT NULL,
    stars_points_yes INTEGER NOT NULL,
    stars_points_no INTEGER NOT NULL,
    price_points_lt_100 INTEGER NOT NULL,
    price_points_gte_100 INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO points_config (
    image_points_yes,
    image_points_no,
    description_points_gt_200,
    description_points_lte_200,
    stars_points_yes,
    stars_points_no,
    price_points_lt_100,
    price_points_gte_100
) VALUES (1, 0, 2, 1, 1, 0, 1, 2);
