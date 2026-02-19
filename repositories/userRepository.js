const { query } = require('../db');

async function findByEmail(email) {
  const result = await query('SELECT * FROM users WHERE email = $1', [email]);
  return result.rows[0] || null;
}

async function findByWallet(walletAddress) {
  const normalized = String(walletAddress || '').trim();
  if (!normalized) return null;

  const walletResult = await query(
    `SELECT u.*
     FROM wallets w
     INNER JOIN users u ON u.id = w.user_id
     WHERE lower(w.address) = lower($1)
     LIMIT 1`,
    [normalized]
  );
  if (walletResult.rows[0]) return walletResult.rows[0];

  const legacyResult = await query('SELECT * FROM users WHERE lower(wallet_address) = lower($1)', [normalized]);
  return legacyResult.rows[0] || null;
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

async function upsertWalletForUser({ userId, address }) {
  const normalized = String(address || '').trim();
  if (!normalized) return null;

  const result = await query(
    `INSERT INTO wallets (user_id, address, last_login)
     VALUES ($1, $2, NOW())
     ON CONFLICT (address)
     DO UPDATE
     SET user_id = EXCLUDED.user_id,
         last_login = NOW()
     RETURNING id, user_id, address, last_login`,
    [userId, normalized]
  );
  return result.rows[0] || null;
}

async function touchWalletLastLogin(address) {
  const normalized = String(address || '').trim();
  if (!normalized) return null;
  const result = await query(
    `UPDATE wallets
     SET last_login = NOW()
     WHERE lower(address) = lower($1)
     RETURNING id, user_id, address, last_login`,
    [normalized]
  );
  return result.rows[0] || null;
}

async function findWalletRecord(address) {
  const normalized = String(address || '').trim();
  if (!normalized) return null;
  const result = await query(
    `SELECT id, user_id, address, last_login, created_at
     FROM wallets
     WHERE lower(address) = lower($1)
     LIMIT 1`,
    [normalized]
  );
  return result.rows[0] || null;
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
    `SELECT u.id, u.wallet_address, u.email, u.name, u.role, u.auth_nonce, u.auth_nonce_expires_at
     FROM users u
     LEFT JOIN wallets w ON w.user_id = u.id
     WHERE lower(u.wallet_address) = lower($1) OR lower(w.address) = lower($1)
     ORDER BY w.created_at DESC NULLS LAST
     LIMIT 1`,
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
  upsertWalletForUser,
  touchWalletLastLogin,
  findWalletRecord,
  setAuthNonce,
  findAuthByWallet,
  findAuthByEmail,
};
