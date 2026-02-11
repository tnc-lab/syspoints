const ethers = require('ethers');

function getKeccak256() {
  if (ethers.utils && ethers.utils.solidityKeccak256) {
    return (types, values) => ethers.utils.solidityKeccak256(types, values);
  }
  if (ethers.solidityPackedKeccak256) {
    return (types, values) => ethers.solidityPackedKeccak256(types, values);
  }
  throw new Error('Keccak256 function not available in ethers');
}

function hashReviewPayload(payload) {
  // Canonical hash: fixed field order and string values.
  const types = ['string', 'string', 'string', 'string', 'string'];
  const values = [
    String(payload.review_id),
    String(payload.user_id),
    String(payload.establishment_id),
    String(payload.timestamp),
    String(payload.price),
  ];

  const keccak256 = getKeccak256();
  return keccak256(types, values);
}

function hashEstablishmentId(establishmentId) {
  const keccak256 = getKeccak256();
  return keccak256(['string'], [String(establishmentId)]);
}

module.exports = {
  hashReviewPayload,
  hashEstablishmentId,
};
