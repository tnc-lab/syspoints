const { URL } = require('url');

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
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

function isValidUuid(value) {
  if (!isNonEmptyString(value)) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isPositiveNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

module.exports = {
  isNonEmptyString,
  isValidEmail,
  isValidUrl,
  isValidUuid,
  isPositiveNumber,
};
