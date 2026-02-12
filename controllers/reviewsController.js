const crypto = require('crypto');
const { reviewService } = require('../services/reviewService');
const { uploadImageDataUrl } = require('../services/fileStorageService');
const { ApiError } = require('../middlewares/errorHandler');
const { isNonEmptyString, isValidUuid, isPositiveNumber, isValidUrl } = require('../utils/validation');

const ALLOWED_IMAGE_MIME = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const MAX_IMAGE_BYTES = 1_500_000;
const REVIEW_TITLE_MAX_WORDS = 12;

function countWords(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

async function createReview(req, res, next) {
  try {
    const {
      user_id,
      establishment_id,
      title,
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

    if (!isNonEmptyString(title)) {
      throw new ApiError(400, 'title is required');
    }

    if (countWords(title) > REVIEW_TITLE_MAX_WORDS) {
      throw new ApiError(400, `title must have at most ${REVIEW_TITLE_MAX_WORDS} words`);
    }

    if (!Number.isInteger(stars) || stars < 0 || stars > 5) {
      throw new ApiError(400, 'stars must be an integer between 0 and 5');
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

    if (!Array.isArray(evidence_images) || evidence_images.length < 1 || evidence_images.length > 3) {
      throw new ApiError(400, 'evidence_images must contain between 1 and 3 items');
    }

    const invalidEvidence = evidence_images.find((url) => !isNonEmptyString(url) || !isValidUrl(url));
    if (invalidEvidence) {
      throw new ApiError(400, 'evidence_images must contain valid URLs');
    }

    const idempotencyKey = req.header('Idempotency-Key') || null;

    const review = await reviewService.createReview({
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
    });

    res.status(201).json(review);
  } catch (err) {
    next(err);
  }
}

async function uploadReviewEvidenceImage(req, res, next) {
  try {
    const { file_name, mime_type, data_url } = req.body || {};

    if (!isNonEmptyString(mime_type) || !ALLOWED_IMAGE_MIME[mime_type]) {
      throw new ApiError(400, 'mime_type must be image/jpeg, image/png, or image/webp');
    }

    if (!isNonEmptyString(data_url)) {
      throw new ApiError(400, 'data_url is required');
    }

    const prefix = `data:${mime_type};base64,`;
    if (!data_url.startsWith(prefix)) {
      throw new ApiError(400, 'data_url must be a base64 data URL with matching mime_type');
    }

    const base64Payload = data_url.slice(prefix.length);
    const buffer = Buffer.from(base64Payload, 'base64');
    if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) {
      throw new ApiError(400, `image size must be between 1 byte and ${MAX_IMAGE_BYTES} bytes`);
    }

    const extension = ALLOWED_IMAGE_MIME[mime_type];
    const safeBaseName = (file_name || 'review-evidence').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'review-evidence';
    const fileName = `${safeBaseName}-${crypto.randomUUID()}.${extension}`;

    const imageUrl = await uploadImageDataUrl(req, {
      scope: 'reviews',
      fileName,
      dataUrl: data_url,
      buffer,
    });
    res.status(201).json({ image_url: imageUrl });
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

module.exports = { createReview, getReviewById, listReviews, uploadReviewEvidenceImage };
