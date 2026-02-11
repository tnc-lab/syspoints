const { query } = require('../db');

async function listEstablishments() {
  const result = await query('SELECT id, name, category, image_url, created_at FROM establishments ORDER BY created_at DESC');
  return result.rows;
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
  createEstablishment,
  findById,
  updateEstablishment,
};
