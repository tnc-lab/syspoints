const { createSigner } = require('../config/syscoin');
const { query } = require('../db');
const { findCoreById } = require('../repositories/reviewRepository');
const { hashReviewPayload } = require('../utils/hash');

async function submitReviewHashAsync(reviewHashHex) {
  // TODO: Define contract address + ABI + method for storing review hash.
  // The docs require asynchronous blockchain interaction, so this function
  // is intentionally fire-and-forget from the review creation flow.
  try {
    const signer = createSigner();
    if (!reviewHashHex) return;

    // TODO: Implement contract call once ABI and address are defined.
    // Example (placeholder): await contract.connect(signer).storeHash(reviewHashHex)
    await signer.provider.getBlockNumber();
  } catch (err) {
    console.error('Syscoin integration error:', err.message || err);
  }
}

async function submitReviewHashByReviewId(reviewId) {
  const review = await findCoreById({ query }, reviewId);
  if (!review) return null;

  const payload = {
    review_id: review.id,
    user_id: review.user_id,
    establishment_id: review.establishment_id,
    timestamp: new Date(review.created_at).toISOString(),
    price: Number(review.price),
  };

  const review_hash = hashReviewPayload(payload);

  submitReviewHashAsync(review_hash);

  return {
    review_id: review.id,
    review_hash,
    payload,
  };
}

module.exports = {
  submitReviewHashAsync,
  submitReviewHashByReviewId,
};
