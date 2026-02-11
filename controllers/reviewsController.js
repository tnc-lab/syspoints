const { reviewService } = require('../services/reviewService');
const { ApiError } = require('../middlewares/errorHandler');
const { isNonEmptyString, isValidUuid, isPositiveNumber, isValidUrl } = require('../utils/validation');

async function createReview(req, res, next) {
  try {
    const {
      user_id,
      establishment_id,
      description,
      stars,
      price,
      purchase_url,
      tags,
      evidence_images,
    } = req.body || {};

    if (!isValidUuid(user_id)) {
      throw new ApiError(400, 'user_id must be a UUID');
    }

    if (!isValidUuid(establishment_id)) {
      throw new ApiError(400, 'establishment_id must be a UUID');
    }

    if (!isNonEmptyString(description)) {
      throw new ApiError(400, 'description is required');
    }

    if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
      throw new ApiError(400, 'stars must be an integer between 1 and 5');
    }

    if (!isPositiveNumber(price)) {
      throw new ApiError(400, 'price must be greater than 0');
    }

    if (!isNonEmptyString(purchase_url) || !isValidUrl(purchase_url)) {
      throw new ApiError(400, 'purchase_url must be a valid URL');
    }

    if (!Array.isArray(tags) || tags.length === 0) {
      throw new ApiError(400, 'tags must be a non-empty array');
    }

    if (!Array.isArray(evidence_images) || evidence_images.length === 0) {
      throw new ApiError(400, 'evidence_images must be a non-empty array');
    }

    const invalidEvidence = evidence_images.find((url) => !isNonEmptyString(url) || !isValidUrl(url));
    if (invalidEvidence) {
      throw new ApiError(400, 'evidence_images must contain valid URLs');
    }

    const idempotencyKey = req.header('Idempotency-Key') || null;

    const review = await reviewService.createReview({
      user_id,
      establishment_id,
      description,
      stars,
      price,
      purchase_url,
      tags,
      evidence_images,
      idempotencyKey,
    });

    res.status(201).json(review);
  } catch (err) {
    next(err);
  }
}

async function getReviewById(req, res, next) {
  try {
    const { id } = req.params;
    if (!isValidUuid(id)) {
      throw new ApiError(400, 'id must be a UUID');
    }

    const review = await reviewService.getReviewById(id);
    if (!review) {
      throw new ApiError(404, 'review not found');
    }

    res.status(200).json(review);
  } catch (err) {
    next(err);
  }
}

async function listReviews(req, res, next) {
  try {
    const page = Number(req.query.page || 1);
    const pageSize = Number(req.query.page_size || 20);
    const establishmentId = req.query.establishment_id || null;
    const sort = req.query.sort || null;

    if (!Number.isInteger(page) || page < 1) {
      throw new ApiError(400, 'page must be a positive integer');
    }

    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
      throw new ApiError(400, 'page_size must be an integer between 1 and 100');
    }

    if (establishmentId && !isValidUuid(establishmentId)) {
      throw new ApiError(400, 'establishment_id must be a UUID');
    }

    if (sort && sort !== 'stars_desc') {
      throw new ApiError(400, 'sort must be stars_desc');
    }

    const result = await reviewService.listReviews({
      page,
      pageSize,
      establishmentId,
      sort,
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { createReview, getReviewById, listReviews };
