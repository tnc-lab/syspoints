const crypto = require('crypto');
const { withTransaction, query } = require('../db');
const {
  createReview,
  findById,
  findCoreById,
  upsertReviewAnchor,
  listReviews: listReviewsRepo,
  countByUserId,
  findLatestByUserId,
} = require('../repositories/reviewRepository');
const { findById: findUserById } = require('../repositories/userRepository');
const { createEvidenceBatch } = require('../repositories/reviewEvidenceRepository');
const { establishmentService } = require('./establishmentService');
const { submitReviewHashAsync } = require('./syscoinService');
const { ApiError } = require('../middlewares/errorHandler');
const { hashReviewPayload } = require('../utils/hash');
const { getCurrentConfig } = require('../repositories/pointsConfigRepository');
const { findByUserAndKey, saveResponse } = require('../repositories/idempotencyRepository');

const idempotencyCache = new Map();

function computePoints({ description, stars, price, evidenceCount, config }) {
  let points = 0;

  if (evidenceCount > 0) points += config.image_points_yes;
  else points += config.image_points_no;

  if (description.length > 200) points += config.description_points_gt_200;
  else points += config.description_points_lte_200;

  if (stars !== null && stars !== undefined) points += config.stars_points_yes;
  else points += config.stars_points_no;

  if (price < 100) points += config.price_points_lt_100;
  else points += config.price_points_gte_100;

  return points;
}

function formatReviewResponse(reviewRow, evidenceImages) {
  return {
    id: reviewRow.id,
    user_id: reviewRow.user_id,
    establishment_id: reviewRow.establishment_id,
    title: reviewRow.title,
    description: reviewRow.description,
    stars: reviewRow.stars,
    price: Number(reviewRow.price),
    purchase_url: reviewRow.purchase_url,
    tags: reviewRow.tags,
    evidence_images: evidenceImages,
    created_at: reviewRow.created_at,
    points_awarded: reviewRow.points_awarded,
    review_hash: reviewRow.review_hash,
    tx_hash: reviewRow.tx_hash || '',
    chain_id: reviewRow.chain_id != null ? Number(reviewRow.chain_id) : null,
    block_number: reviewRow.block_number != null ? Number(reviewRow.block_number) : null,
    block_timestamp: reviewRow.block_timestamp || null,
    tx_recorded_at: reviewRow.tx_recorded_at || null,
  };
}

async function createReviewService({
  user_id,
  establishment_id,
  title,
  description,
  stars,
  price,
  purchase_url,
  tags,
  evidence_images,
  idempotencyKey,
}) {
  if (idempotencyKey) {
    const cacheKey = `${user_id}:${idempotencyKey}`;
    const cached = idempotencyCache.get(cacheKey);
    if (cached) return cached;

    const stored = await findByUserAndKey({ query }, user_id, idempotencyKey);
    if (stored) return stored;
  }

  const establishment = await establishmentService.getEstablishmentById(establishment_id);
  if (!establishment) {
    throw new ApiError(404, 'establishment not found');
  }

  const reviewId = crypto.randomUUID();
  const config = await getCurrentConfig({ query });
  if (!config) {
    throw new ApiError(500, 'points configuration missing');
  }
  const points_awarded = computePoints({
    description,
    stars,
    price,
    evidenceCount: evidence_images.length,
    config,
  });

  const hashPayload = {
    review_id: reviewId,
    user_id,
    establishment_id,
    timestamp: new Date().toISOString(),
    price,
  };

  const review_hash = hashReviewPayload(hashPayload);

  const evidencePayload = evidence_images.map((url) => ({
    image_url: url,
  }));

  let response;

  try {
    response = await withTransaction(async (client) => {
      const reviewRow = await createReview(client, {
        id: reviewId,
        user_id,
        establishment_id,
        title,
        description,
        stars,
        price,
        purchase_url,
        tags,
        points_awarded,
        review_hash,
      });

      await createEvidenceBatch(client, {
        review_id: reviewId,
        evidence: evidencePayload,
      });

      return formatReviewResponse(reviewRow, evidence_images);
    });
  } catch (err) {
    if (err.code === '23505') {
      throw new ApiError(409, 'review_hash already exists');
    }
    if (err.code === '23502' || err.code === '23514') {
      throw new ApiError(400, 'invalid review data');
    }
    throw err;
  }

  if (idempotencyKey) {
    const cacheKey = `${user_id}:${idempotencyKey}`;
    idempotencyCache.set(cacheKey, response);
    await saveResponse({ query }, user_id, idempotencyKey, response);
  }

  const user = await findUserById(user_id);
  if (user && user.wallet_address) {
    submitReviewHashAsync(user.wallet_address, establishment_id, response.review_hash);
  }

  return response;
}

async function getReviewByIdService(id) {
  const review = await findById({ query }, id);
  if (!review) return null;

  return formatReviewResponse(review, review.evidence_images || []);
}

async function listReviewsService({ page, pageSize, establishmentId, sort }) {
  const offset = (page - 1) * pageSize;
  const { rows, total } = await listReviewsRepo({ query }, {
    limit: pageSize,
    offset,
    establishmentId,
    sort,
  });

  const data = rows.map((review) =>
    formatReviewResponse(review, review.evidence_images || [])
  );

  return {
    data,
    meta: {
      page,
      page_size: pageSize,
      total,
    },
  };
}

async function saveReviewAnchorTxService({
  reviewId,
  requesterId,
  requesterRole,
  txHash,
  chainId = null,
  blockNumber = null,
  blockTimestamp = null,
}) {
  const reviewCore = await findCoreById({ query }, reviewId);
  if (!reviewCore) {
    throw new ApiError(404, 'review not found');
  }

  const isOwner = reviewCore.user_id === requesterId;
  const isAdmin = requesterRole === 'admin';
  if (!isOwner && !isAdmin) {
    throw new ApiError(403, 'not allowed to persist transaction metadata for this review');
  }

  try {
    return await upsertReviewAnchor({ query }, {
      review_id: reviewId,
      tx_hash: txHash,
      chain_id: chainId,
      block_number: blockNumber,
      block_timestamp: blockTimestamp,
    });
  } catch (err) {
    if (err.code === '23505') {
      throw new ApiError(409, 'tx_hash already linked to another review');
    }
    if (err.code === '23514' || err.code === '22P02') {
      throw new ApiError(400, 'invalid transaction metadata');
    }
    throw err;
  }
}

async function countReviewsByUserIdService(userId) {
  if (!userId) return 0;
  return countByUserId({ query }, userId);
}

async function shouldRequireReviewCaptchaService(userId) {
  if (!userId) return { required: false, reviewsCount: 0, cooldownMinutes: 10 };

  const reviewsCount = await countByUserId({ query }, userId);
  const cooldownMinutesRaw = Number(process.env.REVIEW_CAPTCHA_COOLDOWN_MINUTES || 10);
  const cooldownMinutes = Number.isFinite(cooldownMinutesRaw) && cooldownMinutesRaw > 0
    ? cooldownMinutesRaw
    : 10;

  if (reviewsCount < 1) {
    return { required: false, reviewsCount, cooldownMinutes };
  }

  const latest = await findLatestByUserId({ query }, userId);
  const latestCreatedAt = latest?.created_at ? new Date(latest.created_at).getTime() : 0;
  if (!latestCreatedAt) {
    return { required: false, reviewsCount, cooldownMinutes };
  }

  const elapsedMs = Date.now() - latestCreatedAt;
  const required = elapsedMs <= cooldownMinutes * 60 * 1000;

  return { required, reviewsCount, cooldownMinutes };
}

module.exports = {
  reviewService: {
    createReview: createReviewService,
    getReviewById: getReviewByIdService,
    listReviews: listReviewsService,
    saveReviewAnchorTx: saveReviewAnchorTxService,
    countReviewsByUserId: countReviewsByUserIdService,
    shouldRequireReviewCaptcha: shouldRequireReviewCaptchaService,
  },
};
