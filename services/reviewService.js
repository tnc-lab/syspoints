const crypto = require('crypto');
const { withTransaction, query } = require('../db');
const { createReview, findById } = require('../repositories/reviewRepository');
const { createEvidenceBatch } = require('../repositories/reviewEvidenceRepository');
const { establishmentService } = require('./establishmentService');
const { submitReviewHashAsync } = require('./syscoinService');
const { ApiError } = require('../middlewares/errorHandler');
const { hashReviewPayload } = require('../utils/hash');

const idempotencyCache = new Map();

function computePoints({ description, stars, price, evidenceCount }) {
  let points = 0;

  if (evidenceCount > 0) points += 1;
  if (description.length > 200) points += 2;
  else points += 1;
  if (stars) points += 1;
  if (price < 100) points += 1;
  else points += 2;

  return points;
}

function formatReviewResponse(reviewRow, evidenceImages) {
  return {
    id: reviewRow.id,
    user_id: reviewRow.user_id,
    establishment_id: reviewRow.establishment_id,
    description: reviewRow.description,
    stars: reviewRow.stars,
    price: Number(reviewRow.price),
    purchase_url: reviewRow.purchase_url,
    tags: reviewRow.tags,
    evidence_images: evidenceImages,
    created_at: reviewRow.created_at,
    points_awarded: reviewRow.points_awarded,
    review_hash: reviewRow.review_hash,
  };
}

async function createReviewService({
  user_id,
  establishment_id,
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
  }

  const establishment = await establishmentService.getEstablishmentById(establishment_id);
  if (!establishment) {
    throw new ApiError(404, 'establishment not found');
  }

  const reviewId = crypto.randomUUID();
  const points_awarded = computePoints({
    description,
    stars,
    price,
    evidenceCount: evidence_images.length,
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
    // TODO: Persist idempotency keys in storage for multi-instance setups.
    idempotencyCache.set(cacheKey, response);
  }

  submitReviewHashAsync(response.review_hash);

  return response;
}

async function getReviewByIdService(id) {
  const review = await findById({ query }, id);
  if (!review) return null;

  return formatReviewResponse(review, review.evidence_images || []);
}

module.exports = {
  reviewService: {
    createReview: createReviewService,
    getReviewById: getReviewByIdService,
  },
};
