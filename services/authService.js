const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const ethers = require('ethers');
const { requireEnv, getOptionalEnv } = require('../config/env');
const { createUser, findByWallet, upsertWalletForUser } = require('../repositories/userRepository');
const {
  createSiweNonce,
  findActiveSiweNonce,
  consumeSiweNonce,
  createAuthSession,
} = require('../repositories/authRepository');

const SIWE_NONCE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_SIWE_STATEMENT = 'Sign in to Syspoints with your wallet.';

function normalizeAddress(address) {
  try {
    return ethers.getAddress(address);
  } catch {
    return '';
  }
}

function normalizeDomain(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').toLowerCase();
}

function parseDurationToMs(value) {
  const text = String(value || '').trim();
  if (!text) return 60 * 60 * 1000;
  const match = /^(\d+)([smhd])$/i.exec(text);
  if (!match) {
    const asSeconds = Number(text);
    return Number.isFinite(asSeconds) && asSeconds > 0 ? asSeconds * 1000 : 60 * 60 * 1000;
  }
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (unit === 's') return amount * 1000;
  if (unit === 'm') return amount * 60 * 1000;
  if (unit === 'h') return amount * 60 * 60 * 1000;
  return amount * 24 * 60 * 60 * 1000;
}

function verifySignature(message, signature, expectedAddress) {
  if (!message || !signature || !expectedAddress) return false;
  try {
    const verifyFn = ethers.verifyMessage || ethers.utils?.verifyMessage;
    if (!verifyFn) return false;
    const recovered = verifyFn(message, signature);
    return normalizeAddress(recovered) === normalizeAddress(expectedAddress);
  } catch {
    return false;
  }
}

function parseSiweMessage(message) {
  const text = String(message || '');
  const pattern = /^(.+) wants you to sign in with your Ethereum account:\n(0x[a-fA-F0-9]{40})\n\n([\s\S]*?)\nURI: (.+)\nVersion: (.+)\nChain ID: (\d+)\nNonce: ([A-Za-z0-9]+)\nIssued At: (.+?)(?:\nExpiration Time: (.+))?$/;
  const match = pattern.exec(text);
  if (!match) return null;

  return {
    domain: String(match[1]).trim(),
    address: normalizeAddress(match[2]),
    statement: String(match[3] || '').trim(),
    uri: String(match[4] || '').trim(),
    version: String(match[5] || '').trim(),
    chainId: Number(match[6]),
    nonce: String(match[7] || '').trim(),
    issuedAt: String(match[8] || '').trim(),
    expirationTime: String(match[9] || '').trim(),
  };
}

function buildDefaultAvatar(walletAddress) {
  const configured = getOptionalEnv('DEFAULT_USER_AVATAR_URL');
  if (configured) return configured;
  const slug = String(walletAddress || '').toLowerCase();
  return `https://api.dicebear.com/9.x/shapes/svg?seed=${encodeURIComponent(slug)}`;
}

async function resolveOrCreateUserByWallet(walletAddress) {
  const normalizedAddress = normalizeAddress(walletAddress);
  if (!normalizedAddress) return null;

  let user = await findByWallet(normalizedAddress);
  if (!user) {
    const id = crypto.randomUUID();
    const short = normalizedAddress.slice(2, 8);
    user = await createUser({
      id,
      wallet_address: normalizedAddress,
      email: null,
      name: `User-${short}`,
      avatar_url: buildDefaultAvatar(normalizedAddress),
      role: 'user',
    });
  }

  await upsertWalletForUser({ userId: user.id, address: normalizedAddress });
  return user;
}

function resolveExpectedDomain({ requestDomain }) {
  const allowed = String(getOptionalEnv('SIWE_ALLOWED_DOMAINS') || '')
    .split(',')
    .map((item) => normalizeDomain(item))
    .filter(Boolean);
  if (allowed.length > 0) return allowed;

  const configured = normalizeDomain(getOptionalEnv('SIWE_DOMAIN'));
  if (configured) return [configured];

  const fromRequest = normalizeDomain(requestDomain);
  return fromRequest ? [fromRequest] : [];
}

async function issueSiweNonce({ walletAddress, domain, uri, chainId }) {
  const normalizedAddress = normalizeAddress(walletAddress);
  if (!normalizedAddress) return null;

  const issuedAt = new Date();
  const expiresAt = new Date(Date.now() + SIWE_NONCE_TTL_MS);
  const nonce = crypto.randomBytes(16).toString('hex');
  const effectiveChainId = Number(chainId || getOptionalEnv('SIWE_CHAIN_ID') || getOptionalEnv('CHAIN_ID') || 0);
  const normalizedDomain = normalizeDomain(domain);
  const normalizedUri = String(uri || '').trim();

  await createSiweNonce({
    address: normalizedAddress,
    nonce,
    domain: normalizedDomain,
    uri: normalizedUri,
    chainId: effectiveChainId,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  });

  return {
    address: normalizedAddress,
    nonce,
    domain: normalizedDomain,
    uri: normalizedUri,
    chain_id: effectiveChainId,
    statement: DEFAULT_SIWE_STATEMENT,
    issued_at: issuedAt.toISOString(),
    expires_at: expiresAt.toISOString(),
  };
}

async function verifySiwe({ message, signature, requestDomain }) {
  const parsed = parseSiweMessage(message);
  if (!parsed || parsed.version !== '1') return null;

  const allowedDomains = resolveExpectedDomain({ requestDomain });
  const parsedDomain = normalizeDomain(parsed.domain);
  if (allowedDomains.length > 0 && !allowedDomains.includes(parsedDomain)) return null;

  const expectedChainId = Number(getOptionalEnv('SIWE_CHAIN_ID') || getOptionalEnv('CHAIN_ID') || 0);
  if (expectedChainId > 0 && Number(parsed.chainId) !== expectedChainId) return null;

  const issuedAtMs = Date.parse(parsed.issuedAt);
  const expirationMs = Date.parse(parsed.expirationTime);
  if (!Number.isFinite(issuedAtMs) || !Number.isFinite(expirationMs)) return null;
  if (expirationMs <= Date.now() || issuedAtMs > Date.now() + 60 * 1000) return null;

  const nonceRecord = await findActiveSiweNonce({ address: parsed.address, nonce: parsed.nonce });
  if (!nonceRecord) return null;
  if (new Date(nonceRecord.expires_at).getTime() < Date.now()) return null;
  if (normalizeDomain(nonceRecord.domain) !== parsedDomain) return null;
  if (Number(nonceRecord.chain_id) !== Number(parsed.chainId)) return null;
  if (String(nonceRecord.uri || '') !== String(parsed.uri || '')) return null;

  if (!verifySignature(message, signature, parsed.address)) return null;

  const consumed = await consumeSiweNonce(nonceRecord.id);
  if (!consumed) return null;

  const user = await resolveOrCreateUserByWallet(parsed.address);
  if (!user) return null;
  const wallet = await upsertWalletForUser({ userId: user.id, address: parsed.address });

  const secret = requireEnv('JWT_SECRET');
  const expiresIn = process.env.JWT_EXPIRES_IN || '1h';
  const sessionTtlMs = parseDurationToMs(expiresIn);
  const sessionExpiresAt = new Date(Date.now() + sessionTtlMs);
  const jti = crypto.randomUUID();

  const token = jwt.sign(
    {
      sub: user.id,
      name: user.name || null,
      email: user.email || null,
      wallet_address: parsed.address,
      role: user.role || 'user',
      points: 0,
    },
    secret,
    { expiresIn, jwtid: jti }
  );

  await createAuthSession({
    userId: user.id,
    walletId: wallet?.id || null,
    jti,
    expiresAt: sessionExpiresAt.toISOString(),
  });

  return {
    access_token: token,
    token_type: 'Bearer',
    expires_in: expiresIn,
    user: {
      id: user.id,
      wallet_address: parsed.address,
      role: user.role || 'user',
      name: user.name || null,
      email: user.email || null,
      points: 0,
    },
  };
}

module.exports = {
  authService: {
    issueSiweNonce,
    verifySiwe,
  },
};
