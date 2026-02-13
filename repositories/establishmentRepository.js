const { query } = require('../db');

async function listEstablishments() {
  const result = await query('SELECT id, name, category, image_url, created_at FROM establishments ORDER BY created_at DESC');
  return result.rows;
}

async function listTopReviewedEstablishments({ limit, offset }) {
  const dataResult = await query(
    `SELECT
      e.id,
      e.name,
      e.category,
      e.image_url,
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

async function createEstablishment({ id, name, category, image_url }) {
  const result = await query(
    `INSERT INTO establishments (id, name, category, image_url)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, category, image_url, created_at`,
    [id, name, category, image_url || null]
  );
  return result.rows[0];
}

async function findById(id) {
  const result = await query('SELECT id, name, category, image_url, created_at FROM establishments WHERE id = $1', [id]);
  return result.rows[0] || null;
}

async function updateEstablishment({ id, name, category, image_url }) {
  const result = await query(
    `UPDATE establishments
     SET name = $2,
         category = $3,
         image_url = $4
     WHERE id = $1
     RETURNING id, name, category, image_url, created_at`,
    [id, name, category, image_url || null]
  );
  return result.rows[0] || null;
}

module.exports = {
  listEstablishments,
  listTopReviewedEstablishments,
  createEstablishment,
  findById,
  updateEstablishment,
};
