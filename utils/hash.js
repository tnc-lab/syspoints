const crypto = require('crypto');

function hashReviewPayload(payload) {
  // TODO: Confirm hash algorithm/specification. Using SHA-256 over JSON.
  const json = JSON.stringify(payload);
  return crypto.createHash('sha256').update(json).digest('hex');
}

module.exports = {
  hashReviewPayload,
};
