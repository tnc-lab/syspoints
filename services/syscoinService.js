const { createProvider, createSigner, getSyscoinConfig } = require('../config/syscoin');
const { query } = require('../db');
const { findCoreById } = require('../repositories/reviewRepository');
const { hashReviewPayload, hashEstablishmentId } = require('../utils/hash');
const { findById } = require('../repositories/userRepository');
const ethers = require('ethers');

const SYSPPOINTS_ABI = [
  'function anchorReview(address user, bytes32 reviewHash, bytes32 establishmentId) external',
  'function anchorApprovedReview(address user, bytes32 reviewHash, bytes32 establishmentId) external',
  'function approveReview(bytes32 reviewHash) external',
  'function rejectReview(bytes32 reviewHash) external',
  'function executeApprovedReviewEffect(bytes32 reviewHash) external returns (bool)',
  'function getReviewStatus(bytes32 reviewHash) external view returns (uint8)',
  'function isReviewApproved(bytes32 reviewHash) external view returns (bool)',
  'function getReviewAnchor(bytes32 reviewHash) external view returns (address user, bytes32 establishmentId, uint256 anchoredAt, uint256 reviewedAt, uint8 status, bool executed)',
  'event ReviewAnchored(address indexed user, bytes32 indexed reviewHash, bytes32 indexed establishmentId, uint256 timestamp)',
  'event ReviewApproved(bytes32 indexed reviewHash, address indexed reviewer, uint256 timestamp)',
  'event ReviewRejected(bytes32 indexed reviewHash, address indexed reviewer, uint256 timestamp)',
  'event ReviewEffectExecuted(bytes32 indexed reviewHash, address indexed executor, uint256 timestamp)',
];

const REVIEW_CHAIN_STATUS = {
  NONE: 0,
  PENDING: 1,
  APPROVED: 2,
  REJECTED: 3,
};

function createContract() {
  const signer = createSigner();
  const { contractAddress } = getSyscoinConfig();
  return new ethers.Contract(contractAddress, SYSPPOINTS_ABI, signer);
}

function createContractInterface() {
  return new ethers.Interface(SYSPPOINTS_ABI);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function anchorApprovedReviewOnChain({
  userWallet,
  reviewHash,
  establishmentId,
}) {
  if (!userWallet || !reviewHash || !establishmentId) {
    throw new Error('missing parameters to anchor approved review');
  }

  const contract = createContract();
  const establishmentHash = hashEstablishmentId(establishmentId);
  const tx = await contract.anchorApprovedReview(userWallet, reviewHash, establishmentHash);
  const receipt = await tx.wait();
  if (!receipt || Number(receipt.status) !== 1) {
    throw new Error('anchorApprovedReview transaction failed');
  }

  let blockTimestamp = null;
  if (receipt.blockNumber != null) {
    try {
      const provider = createProvider();
      const block = await provider.getBlock(receipt.blockNumber);
      if (block?.timestamp != null) {
        blockTimestamp = new Date(Number(block.timestamp) * 1000).toISOString();
      }
    } catch {
      blockTimestamp = null;
    }
  }

  return {
    txHash: tx.hash,
    chainId: Number(getSyscoinConfig().chainId),
    blockNumber: receipt.blockNumber != null ? Number(receipt.blockNumber) : null,
    blockTimestamp,
  };
}

async function verifyAnchoredReviewTx({
  txHash,
  expectedUserWallet,
  expectedReviewHash,
  expectedEstablishmentId,
}) {
  if (!txHash || !expectedUserWallet || !expectedReviewHash || !expectedEstablishmentId) {
    return { ok: false, reason: 'missing verification parameters' };
  }

  const provider = createProvider();

  const normalizedUserWallet = ethers.getAddress(expectedUserWallet);
  const normalizedReviewHash = ethers.hexlify(expectedReviewHash).toLowerCase();
  const expectedEstablishmentHash = hashEstablishmentId(expectedEstablishmentId).toLowerCase();
  const { contractAddress, chainId } = getSyscoinConfig();
  const interfaceAbi = createContractInterface();

  let receipt = null;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    receipt = await provider.getTransactionReceipt(txHash);
    if (receipt) break;
    await sleep(1500);
  }
  if (!receipt) {
    return { ok: false, reason: 'transaction receipt not found yet' };
  }

  if (Number(receipt.status) !== 1) {
    return { ok: false, reason: 'transaction not successful' };
  }

  if (String(receipt.to || '').toLowerCase() !== String(contractAddress).toLowerCase()) {
    return { ok: false, reason: 'transaction target contract mismatch' };
  }

  const matchingEvent = (receipt.logs || []).find((log) => {
    if (String(log.address || '').toLowerCase() !== String(contractAddress).toLowerCase()) return false;
    try {
      const parsed = interfaceAbi.parseLog(log);
      if (!parsed || parsed.name !== 'ReviewAnchored') return false;
      const eventUser = ethers.getAddress(parsed.args.user);
      const eventReviewHash = String(parsed.args.reviewHash || '').toLowerCase();
      const eventEstablishmentHash = String(parsed.args.establishmentId || '').toLowerCase();
      return (
        eventUser === normalizedUserWallet &&
        eventReviewHash === normalizedReviewHash &&
        eventEstablishmentHash === expectedEstablishmentHash
      );
    } catch {
      return false;
    }
  });

  if (!matchingEvent) {
    return { ok: false, reason: 'matching ReviewAnchored event not found' };
  }

  let blockTimestamp = null;
  if (receipt.blockNumber != null) {
    try {
      const block = await provider.getBlock(receipt.blockNumber);
      if (block?.timestamp != null) {
        blockTimestamp = new Date(Number(block.timestamp) * 1000).toISOString();
      }
    } catch {
      blockTimestamp = null;
    }
  }

  return {
    ok: true,
    txHash,
    chainId: Number(chainId),
    blockNumber: receipt.blockNumber != null ? Number(receipt.blockNumber) : null,
    blockTimestamp,
  };
}

async function getReviewStatusOnChain(reviewHash) {
  if (!reviewHash) return { ok: false, reason: 'review_hash is required' };

  try {
    const provider = createProvider();
    const { contractAddress } = getSyscoinConfig();
    const contract = new ethers.Contract(contractAddress, SYSPPOINTS_ABI, provider);
    const statusRaw = await contract.getReviewStatus(reviewHash);
    const status = Number(statusRaw);
    return {
      ok: true,
      status,
      isPending: status === REVIEW_CHAIN_STATUS.PENDING,
      isApproved: status === REVIEW_CHAIN_STATUS.APPROVED,
      isRejected: status === REVIEW_CHAIN_STATUS.REJECTED,
    };
  } catch (err) {
    return { ok: false, reason: err?.message || 'failed to fetch review status from chain' };
  }
}

module.exports = {
  REVIEW_CHAIN_STATUS,
  submitReviewHashAsync,
  submitReviewHashByReviewId,
  anchorApprovedReviewOnChain,
  verifyAnchoredReviewTx,
  getReviewStatusOnChain,
};
