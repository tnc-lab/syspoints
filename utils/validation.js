const { URL } = require('url');

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeTextInput(value) {
  return normalizeWhitespace(String(value || '').normalize('NFKC'));
}

function containsEmoji(value) {
  return /[\p{Extended_Pictographic}\p{Emoji_Presentation}]/u.test(String(value || ''));
}

function containsUnsafeHtmlLikeContent(value) {
  const text = String(value || '');
  if (!text) return false;

  return (
    /<[^>]*>/i.test(text) ||
    /<\/?[a-z][\s\S]*?>/i.test(text) ||
    /&(?:lt|gt|#x0*3c|#0*60);/i.test(text) ||
    /\b(?:javascript|vbscript)\s*:/i.test(text) ||
    /\bdata\s*:\s*text\/html/i.test(text)
  );
}

function isSafeReviewText(value, { minLength = 1, maxLength = 2000 } = {}) {
  const normalized = normalizeTextInput(value);
  if (!normalized) {
    return { ok: false, normalized, reason: 'required' };
  }

  if (normalized.length < minLength) {
    return { ok: false, normalized, reason: 'too_short' };
  }
  if (normalized.length > maxLength) {
    return { ok: false, normalized, reason: 'too_long' };
  }
  if (containsUnsafeHtmlLikeContent(normalized)) {
    return { ok: false, normalized, reason: 'html_not_allowed' };
  }
  if (containsEmoji(normalized)) {
    return { ok: false, normalized, reason: 'emoji_not_allowed' };
  }

  return { ok: true, normalized };
}

function isValidEmail(value) {
  if (!isNonEmptyString(value)) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidUrl(value) {
  if (!isNonEmptyString(value)) return false;
  try {
    new URL(value);
    return true;
  } catch (err) {
    return false;
  }
}

function isValidHttpUrl(value) {
  if (!isNonEmptyString(value)) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (err) {
    return false;
  }
}

function isValidUuid(value) {
  if (!isNonEmptyString(value)) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isPositiveNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

module.exports = {
  isNonEmptyString,
  normalizeWhitespace,
  normalizeTextInput,
  containsEmoji,
  containsUnsafeHtmlLikeContent,
  isSafeReviewText,
  isValidEmail,
  isValidUrl,
  isValidHttpUrl,
  isValidUuid,
  isPositiveNumber,
};
