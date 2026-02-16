-- Migration: add location metadata to establishments

ALTER TABLE establishments
ADD COLUMN IF NOT EXISTS address TEXT;

ALTER TABLE establishments
ADD COLUMN IF NOT EXISTS latitude NUMERIC(9, 6);

ALTER TABLE establishments
ADD COLUMN IF NOT EXISTS longitude NUMERIC(9, 6);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'establishments_latitude_range'
  ) THEN
    ALTER TABLE establishments
    ADD CONSTRAINT establishments_latitude_range CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'establishments_longitude_range'
  ) THEN
    ALTER TABLE establishments
    ADD CONSTRAINT establishments_longitude_range CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS establishments_name_address_unique_idx
ON establishments (lower(trim(name)), lower(trim(address)))
WHERE address IS NOT NULL;
