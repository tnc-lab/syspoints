const { query } = require('../db');

async function listEstablishments() {
  const result = await query('SELECT id, name, category, created_at FROM establishments ORDER BY created_at DESC');
  return result.rows;
}

async function createEstablishment({ id, name, category }) {
  const result = await query(
    `INSERT INTO establishments (id, name, category)
     VALUES ($1, $2, $3)
     RETURNING id, name, category, created_at`,
    [id, name, category]
  );
  return result.rows[0];
}

async function findById(id) {
  const result = await query('SELECT id, name, category, created_at FROM establishments WHERE id = $1', [id]);
  return result.rows[0] || null;
}

module.exports = {
  listEstablishments,
  createEstablishment,
  findById,
};
