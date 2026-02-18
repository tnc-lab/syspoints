const { query } = require('../db');

async function createSiweNonce({ address, nonce, domain, uri, chainId, issuedAt, expiresAt }) {
  const result = await query(
    `INSERT INTO auth_nonces (wallet_address, nonce, domain, uri, chain_id, issued_at, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, wallet_address, nonce, domain, uri, chain_id, issued_at, expires_at, consumed_at`,
    [address, nonce, domain, uri, chainId, issuedAt, expiresAt]
  );
  return result.rows[0] || null;
}

async function findActiveSiweNonce({ address, nonce }) {
  const result = await query(
    `SELECT id, wallet_address, nonce, domain, uri, chain_id, issued_at, expires_at, consumed_at
     FROM auth_nonces
     WHERE lower(wallet_address) = lower($1)
       AND nonce = $2
       AND consumed_at IS NULL
     LIMIT 1`,
    [address, nonce]
  );
  return result.rows[0] || null;
}

async function consumeSiweNonce(id) {
  const result = await query(
    `UPDATE auth_nonces
     SET consumed_at = NOW()
     WHERE id = $1
       AND consumed_at IS NULL
     RETURNING id, consumed_at`,
    [id]
  );
  return result.rows[0] || null;
}

async function createAuthSession({ userId, walletId, jti, expiresAt }) {
  const result = await query(
    `INSERT INTO auth_sessions (user_id, wallet_id, jti, expires_at)
     VALUES ($1, $2, $3, $4)
     RETURNING id, user_id, wallet_id, jti, issued_at, expires_at, revoked_at`,
    [userId, walletId, jti, expiresAt]
  );
  return result.rows[0] || null;
}

async function findActiveSessionByJti(jti) {
  const result = await query(
    `SELECT id, user_id, wallet_id, jti, issued_at, expires_at, revoked_at
     FROM auth_sessions
     WHERE jti = $1
       AND revoked_at IS NULL
       AND expires_at > NOW()
     LIMIT 1`,
    [jti]
  );
  return result.rows[0] || null;
}

module.exports = {
  createSiweNonce,
  findActiveSiweNonce,
  consumeSiweNonce,
  createAuthSession,
  findActiveSessionByJti,
};
