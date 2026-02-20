const { query } = require('../db');

async function listEstablishments() {
  const result = await query(
    `SELECT id, name, category, image_url, address, country, state_region, district, latitude, longitude, created_at
     FROM establishments
     ORDER BY created_at DESC`
  );
  return result.rows;
}

async function listTopReviewedEstablishments({ limit, offset }) {
  const dataResult = await query(
    `SELECT
      e.id,
      e.name,
      e.category,
      e.image_url,
      e.address,
      e.country,
      e.state_region,
      e.district,
      e.latitude,
      e.longitude,
      COUNT(r.id)::int AS review_count,
      ROUND(AVG(r.stars)::numeric, 2)::float8 AS avg_stars
     FROM establishments e
     JOIN reviews r ON r.establishment_id = e.id
     GROUP BY e.id
     ORDER BY review_count DESC, avg_stars DESC, e.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  const countResult = await query(
    `SELECT COUNT(*)::int AS total
     FROM (
       SELECT r.establishment_id
       FROM reviews r
       GROUP BY r.establishment_id
     ) grouped_reviews`
  );

  return {
    rows: dataResult.rows,
    total: countResult.rows[0]?.total || 0,
  };
}

async function createEstablishment({
  id,
  name,
  category,
  image_url,
  address,
  country,
  state_region,
  district,
  latitude,
  longitude,
}) {
  const result = await query(
    `INSERT INTO establishments (id, name, category, image_url, address, country, state_region, district, latitude, longitude)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id, name, category, image_url, address, country, state_region, district, latitude, longitude, created_at`,
    [
      id,
      name,
      category,
      image_url || null,
      address || null,
      country || null,
      state_region || null,
      district || null,
      latitude ?? null,
      longitude ?? null,
    ]
  );
  return result.rows[0];
}

async function findById(id) {
  const result = await query(
    `SELECT id, name, category, image_url, address, country, state_region, district, latitude, longitude, created_at
     FROM establishments
     WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

async function findByNameAndAddress({ name, address }) {
  const result = await query(
    `SELECT id, name, category, image_url, address, country, state_region, district, latitude, longitude, created_at
     FROM establishments
     WHERE lower(trim(name)) = lower(trim($1))
       AND lower(trim(address)) = lower(trim($2))
     LIMIT 1`,
    [name, address]
  );

  return result.rows[0] || null;
}

async function searchSavedByText({ queryText, limit = 6, category = null }) {
  const normalizedText = String(queryText || '').trim();
  if (!normalizedText) return [];
  const normalizedLimit = Math.max(1, Math.min(Number(limit) || 6, 20));
  const normalizedCategory = String(category || '').trim();

  const values = [`%${normalizedText}%`];
  let categoryFilter = '';
  if (normalizedCategory) {
    values.push(normalizedCategory);
    categoryFilter = `AND lower(e.category) = lower($${values.length})`;
  }

  values.push(normalizedLimit);
  const limitIndex = values.length;

  const result = await query(
    `SELECT
      e.id,
      e.name,
      e.category,
      e.image_url,
      e.address,
      e.country,
      e.state_region,
      e.district,
      e.latitude,
      e.longitude,
      e.created_at
     FROM establishments e
     WHERE (
       e.name ILIKE $1
       OR COALESCE(e.address, '') ILIKE $1
       OR COALESCE(e.country, '') ILIKE $1
       OR COALESCE(e.state_region, '') ILIKE $1
       OR COALESCE(e.district, '') ILIKE $1
       OR COALESCE(e.category, '') ILIKE $1
     )
     ${categoryFilter}
     ORDER BY e.created_at DESC
     LIMIT $${limitIndex}`,
    values
  );

  return result.rows;
}

async function updateEstablishment({
  id,
  name,
  category,
  image_url,
  address,
  country,
  state_region,
  district,
  latitude,
  longitude,
}) {
  const result = await query(
    `UPDATE establishments
     SET name = $2,
         category = $3,
         image_url = $4,
         address = $5,
         country = $6,
         state_region = $7,
         district = $8,
         latitude = $9,
         longitude = $10
     WHERE id = $1
     RETURNING id, name, category, image_url, address, country, state_region, district, latitude, longitude, created_at`,
    [
      id,
      name,
      category,
      image_url || null,
      address || null,
      country || null,
      state_region || null,
      district || null,
      latitude ?? null,
      longitude ?? null,
    ]
  );
  return result.rows[0] || null;
}

module.exports = {
  listEstablishments,
  listTopReviewedEstablishments,
  createEstablishment,
  findById,
  findByNameAndAddress,
  searchSavedByText,
  updateEstablishment,
};
