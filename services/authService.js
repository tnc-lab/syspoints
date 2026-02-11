const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const ethers = require('ethers');
const { requireEnv } = require('../config/env');
const { findAuthByWallet, setAuthNonce } = require('../repositories/userRepository');

function verifySignature(message, signature, expectedAddress) {
  if (!message || !signature || !expectedAddress) return false;

  try {
    const verifyFn = ethers.utils?.verifyMessage || ethers.verifyMessage;
    if (!verifyFn) return false;
    const recovered = verifyFn(message, signature);
    return recovered.toLowerCase() === expectedAddress.toLowerCase();
  } catch {
    return false;
  }
}

async function issueNonce({ wallet_address }) {
  const user = await findAuthByWallet(wallet_address);

  if (!user) return null;

  const nonce = crypto.randomBytes(16).toString('hex');
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  const updated = await setAuthNonce(user.id, nonce, expiresAt);

  return {
    user_id: updated.id,
    wallet_address: updated.wallet_address,
    nonce: updated.auth_nonce,
    expires_at: updated.auth_nonce_expires_at,
  };
}

async function issueToken({ wallet_address, signature }) {
  const user = await findAuthByWallet(wallet_address);
  if (!user || !user.auth_nonce) return null;

  const expiresAt = user.auth_nonce_expires_at ? new Date(user.auth_nonce_expires_at) : null;
  if (!expiresAt || expiresAt.getTime() < Date.now()) return null;

  const message = `Syspoints login nonce: ${user.auth_nonce}`;
  const valid = verifySignature(message, signature, user.wallet_address);
  if (!valid) return null;

  const secret = requireEnv('JWT_SECRET');
  const expiresIn = process.env.JWT_EXPIRES_IN || '1h';

  const token = jwt.sign(
    {
      sub: user.id,
      email: user.email || null,
      wallet_address: user.wallet_address,
      role: user.role || 'user',
    },
    secret,
    { expiresIn }
  );

  await setAuthNonce(user.id, null, null);

  return {
    access_token: token,
    token_type: 'Bearer',
    expires_in: expiresIn,
  };
}

module.exports = {
  authService: {
    issueNonce,
    issueToken,
  },
};
