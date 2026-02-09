const { query } = require('../db');

async function findByEmail(email) {
  const result = await query('SELECT * FROM users WHERE email = $1', [email]);
  return result.rows[0] || null;
}

async function findByWallet(walletAddress) {
  const result = await query('SELECT * FROM users WHERE wallet_address = $1', [walletAddress]);
  return result.rows[0] || null;
}

async function createUser({ id, wallet_address, email, name, avatar_url }) {
  const result = await query(
    `INSERT INTO users (id, wallet_address, email, name, avatar_url)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, wallet_address, email, name, avatar_url, created_at`,
    [id, wallet_address, email, name, avatar_url]
  );
  return result.rows[0];
}

module.exports = {
  findByEmail,
  findByWallet,
  createUser,
};
