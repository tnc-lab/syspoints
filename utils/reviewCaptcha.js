const crypto = require('crypto');
const { requireEnv } = require('../config/env');

const CAPTCHA_TTL_MS = 5 * 60 * 1000;

function toBase64Url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromBase64Url(input) {
  const normalized = String(input || '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + pad, 'base64').toString('utf8');
}

function signPayload(payloadB64) {
  const secret = requireEnv('JWT_SECRET');
  return toBase64Url(crypto.createHmac('sha256', secret).update(payloadB64).digest());
}

function hashAnswer({ userId, nonce, answer }) {
  return crypto
    .createHash('sha256')
    .update(`${String(userId || '')}:${String(nonce || '')}:${String(answer || '')}`)
    .digest('hex');
}

function buildReviewCaptchaChallenge({ userId }) {
  const left = crypto.randomInt(10, 50);
  const right = crypto.randomInt(1, 10);
  const answer = left + right;
  const nonce = crypto.randomUUID();
  const exp = Date.now() + CAPTCHA_TTL_MS;

  const payload = {
    uid: String(userId),
    n: nonce,
    h: hashAnswer({ userId, nonce, answer }),
    exp,
  };
  const payloadB64 = toBase64Url(JSON.stringify(payload));
  const sig = signPayload(payloadB64);

  return {
    token: `${payloadB64}.${sig}`,
    question: `Resuelve: ${left} + ${right}`,
    expires_at: new Date(exp).toISOString(),
  };
}

function verifyReviewCaptchaAnswer({ userId, token, answer }) {
  const rawToken = String(token || '');
  const parts = rawToken.split('.');
  if (parts.length !== 2) return { ok: false, reason: 'invalid token format' };

  const [payloadB64, sig] = parts;
  const expectedSig = signPayload(payloadB64);
  const left = Buffer.from(sig);
  const right = Buffer.from(expectedSig);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) {
    return { ok: false, reason: 'invalid token signature' };
  }

  let payload;
  try {
    payload = JSON.parse(fromBase64Url(payloadB64));
  } catch {
    return { ok: false, reason: 'invalid token payload' };
  }

  if (!payload?.uid || !payload?.n || !payload?.h || !payload?.exp) {
    return { ok: false, reason: 'invalid token claims' };
  }

  if (String(payload.uid) !== String(userId)) {
    return { ok: false, reason: 'token user mismatch' };
  }

  if (Number(payload.exp) < Date.now()) {
    return { ok: false, reason: 'token expired' };
  }

  const expectedHash = hashAnswer({
    userId,
    nonce: payload.n,
    answer: String(answer || '').trim(),
  });

  if (expectedHash !== payload.h) {
    return { ok: false, reason: 'wrong answer' };
  }

  return { ok: true };
}

module.exports = {
  buildReviewCaptchaChallenge,
  verifyReviewCaptchaAnswer,
};
