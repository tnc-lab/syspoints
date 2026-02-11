const { query } = require('../db');

async function findByEmail(email) {
  const result = await query('SELECT * FROM users WHERE email = $1', [email]);
  return result.rows[0] || null;
}

async function findByWallet(walletAddress) {
  const result = await query('SELECT * FROM users WHERE wallet_address = $1', [walletAddress]);
  return result.rows[0] || null;
}

async function createUser({ id, wallet_address, email, name, avatar_url, role }) {
  const result = await query(
    `INSERT INTO users (id, wallet_address, email, name, avatar_url, role)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, wallet_address, email, name, avatar_url, role, created_at`,
    [id, wallet_address, email, name, avatar_url, role]
  );
  return result.rows[0];
}

async function listUsers() {
  const result = await query(
    'SELECT id, wallet_address, email, name, avatar_url, role, created_at FROM users ORDER BY created_at DESC'
  );
  return result.rows;
}

async function findById(id) {
  const result = await query(
    'SELECT id, wallet_address, email, name, avatar_url, role, created_at FROM users WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}

async function updateById(id, { name, email, avatar_url }) {
  const result = await query(
    `UPDATE users
     SET name = $2,
         email = $3,
         avatar_url = $4
     WHERE id = $1
     RETURNING id, wallet_address, email, name, avatar_url, role, created_at`,
    [id, name, email, avatar_url]
  );
  return result.rows[0] || null;
}

async function setAuthNonce(userId, nonce, expiresAt) {
  const result = await query(
    `UPDATE users
     SET auth_nonce = $2, auth_nonce_expires_at = $3
     WHERE id = $1
     RETURNING id, wallet_address, email, name, role, auth_nonce, auth_nonce_expires_at`,
    [userId, nonce, expiresAt]
  );
  return result.rows[0] || null;
}

async function findAuthByWallet(walletAddress) {
  const result = await query(
    `SELECT id, wallet_address, email, name, role, auth_nonce, auth_nonce_expires_at
     FROM users
     WHERE wallet_address = $1`,
    [walletAddress]
  );
  return result.rows[0] || null;
}

async function findAuthByEmail(email) {
  const result = await query(
    `SELECT id, wallet_address, email, name, role, auth_nonce, auth_nonce_expires_at
     FROM users
     WHERE email = $1`,
    [email]
  );
  return result.rows[0] || null;
}

module.exports = {
  findByEmail,
  findByWallet,
  createUser,
  listUsers,
  findById,
  updateById,
  setAuthNonce,
  findAuthByWallet,
  findAuthByEmail,
};
