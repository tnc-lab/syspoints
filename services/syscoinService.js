const { createSigner, getSyscoinConfig } = require('../config/syscoin');
const { query } = require('../db');
const { findCoreById } = require('../repositories/reviewRepository');
const { hashReviewPayload, hashEstablishmentId } = require('../utils/hash');
const { findById } = require('../repositories/userRepository');
const ethers = require('ethers');

const SYSPPOINTS_ABI = [
  'function anchorReview(address user, bytes32 reviewHash, bytes32 establishmentId) external',
  'event ReviewAnchored(address indexed user, bytes32 indexed reviewHash, bytes32 indexed establishmentId, uint256 timestamp)',
];

function createContract() {
  const signer = createSigner();
  const { contractAddress } = getSyscoinConfig();
  if (ethers.Contract) {
    return new ethers.Contract(contractAddress, SYSPPOINTS_ABI, signer);
  }
  return new ethers.Contract(contractAddress, SYSPPOINTS_ABI, signer);
}

async function submitReviewHashAsync(userWallet, establishmentId, reviewHashHex) {
  // TODO: Define contract address + ABI + method for storing review hash.
  // The docs require asynchronous blockchain interaction, so this function
  // is intentionally fire-and-forget from the review creation flow.
  try {
    const contract = createContract();
    if (!reviewHashHex || !establishmentId || !userWallet) return;

    // TODO: Implement contract call once ABI and address are defined.
    // Using current Syspoints contract: addReview(establishment, review).
    const establishmentHash = hashEstablishmentId(establishmentId);
    await contract.anchorReview(userWallet, reviewHashHex, establishmentHash);
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
  const establishment_hash = hashEstablishmentId(payload.establishment_id);

  const user = await findById(payload.user_id);
  if (!user || !user.wallet_address) return null;

  const contract = createContract();
  const tx = await contract.anchorReview(user.wallet_address, review_hash, establishment_hash);

  return {
    review_id: review.id,
    review_hash,
    payload,
    establishment_id_hash: establishment_hash,
    user_wallet: user.wallet_address,
    tx_hash: tx.hash,
  };
}

module.exports = {
  submitReviewHashAsync,
  submitReviewHashByReviewId,
};
