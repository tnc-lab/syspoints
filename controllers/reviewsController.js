const crypto = require('crypto');
const ethers = require('ethers');
const { reviewService } = require('../services/reviewService');
const { uploadImageDataUrl } = require('../services/fileStorageService');
const { ApiError } = require('../middlewares/errorHandler');
const {
  isNonEmptyString,
  isValidUuid,
  isPositiveNumber,
  isValidHttpUrl,
  isSafeReviewText,
} = require('../utils/validation');
const { buildReviewCaptchaChallenge, verifyReviewCaptchaAnswer } = require('../utils/reviewCaptcha');
const { getSyscoinConfig } = require('../config/syscoin');
const { findById: findUserById } = require('../repositories/userRepository');

const ALLOWED_IMAGE_MIME = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const MAX_IMAGE_BYTES = 1_500_000;
const REVIEW_TITLE_MAX_CHARS = 120;
const REVIEW_DESCRIPTION_MAX_CHARS = 2000;
const REVIEW_TAG_MIN_CHARS = 2;
const REVIEW_TAG_MAX_CHARS = 30;
const REVIEW_TAG_ALLOWED_REGEX = /^[\p{L}\p{N}][\p{L}\p{N}\s._-]*$/u;

function buildReviewSubmissionTypedData({
  review_id,
  user_id,
  establishment_id,
  review_hash,
  signature_nonce,
  signature_deadline,
}) {
  const { chainId, contractAddress } = getSyscoinConfig();
  return {
    domain: {
      name: 'Syspoints',
      version: '1',
      chainId: Number(chainId),
      verifyingContract: contractAddress,
    },
    types: {
      ReviewSubmission: [
        { name: 'review_id', type: 'string' },
        { name: 'user_id', type: 'string' },
        { name: 'establishment_id', type: 'string' },
        { name: 'review_hash', type: 'bytes32' },
        { name: 'signature_nonce', type: 'string' },
        { name: 'signature_deadline', type: 'uint256' },
      ],
    },
    primaryType: 'ReviewSubmission',
    message: {
      review_id: String(review_id),
      user_id: String(user_id),
      establishment_id: String(establishment_id),
      review_hash: String(review_hash),
      signature_nonce: String(signature_nonce),
      signature_deadline: Math.floor(new Date(signature_deadline).getTime() / 1000),
    },
  };
}

function assertSafeReviewField(fieldName, value, { minLength = 1, maxLength = 2000 } = {}) {
  const validation = isSafeReviewText(value, { minLength, maxLength });
  if (!validation.ok) {
    if (validation.reason === 'required') {
      throw new ApiError(400, `${fieldName} is required`);
    }
    if (validation.reason === 'too_short') {
      throw new ApiError(400, `${fieldName} is too short`);
    }
    if (validation.reason === 'too_long') {
      throw new ApiError(400, `${fieldName} exceeds max length of ${maxLength}`);
    }
    if (validation.reason === 'html_not_allowed') {
      throw new ApiError(400, `${fieldName} must not contain HTML or script-like content`);
    }
    if (validation.reason === 'emoji_not_allowed') {
      throw new ApiError(400, `${fieldName} must not contain emojis`);
    }
    throw new ApiError(400, `${fieldName} is invalid`);
  }

  return validation.normalized;
}

function normalizeAndValidateTags(tags) {
  if (!Array.isArray(tags) || tags.length === 0) {
    throw new ApiError(400, 'tags must be a non-empty array');
  }

  const dedup = new Map();
  for (const rawTag of tags) {
    if (typeof rawTag !== 'string') {
      throw new ApiError(400, 'each tag must be a string');
    }

    const tag = assertSafeReviewField('tag', rawTag, {
      minLength: REVIEW_TAG_MIN_CHARS,
      maxLength: REVIEW_TAG_MAX_CHARS,
    });

    if (!REVIEW_TAG_ALLOWED_REGEX.test(tag)) {
      throw new ApiError(
        400,
        'tags may only contain letters, numbers, spaces, dots, underscores, and hyphens'
      );
    }

    const dedupKey = tag.toLowerCase();
    if (!dedup.has(dedupKey)) {
      dedup.set(dedupKey, tag);
    }
  }

  const normalizedTags = Array.from(dedup.values());
  if (normalizedTags.length === 0) {
    throw new ApiError(400, 'tags must be a non-empty array');
  }

  return normalizedTags;
}

async function createReview(req, res, next) {
  try {
    const {
      review_id,
      review_hash,
      review_timestamp,
      tx_hash,
      user_id,
      establishment_id,
      title,
      description,
      stars,
      price,
      purchase_url,
      tags,
      evidence_images,
      captcha_token,
      captcha_answer,
    } = req.body || {};

    if (!isValidUuid(review_id)) {
      throw new ApiError(400, 'review_id must be a UUID');
    }
    if (!isNonEmptyString(review_hash) || !/^0x[a-fA-F0-9]{64}$/.test(review_hash)) {
      throw new ApiError(400, 'review_hash must be a 32-byte hex string');
    }
    if (!isNonEmptyString(tx_hash) || !/^0x[a-fA-F0-9]{64}$/.test(tx_hash)) {
      throw new ApiError(400, 'tx_hash must be a valid transaction hash');
    }
    const parsedReviewTimestamp = new Date(review_timestamp);
    if (!review_timestamp || Number.isNaN(parsedReviewTimestamp.getTime())) {
      throw new ApiError(400, 'review_timestamp must be a valid datetime');
    }

    if (!isValidUuid(user_id)) {
      throw new ApiError(400, 'user_id must be a UUID');
    }
    if (req.auth?.sub !== user_id) {
      throw new ApiError(403, 'user_id does not match authenticated user');
    }

    if (!isValidUuid(establishment_id)) {
      throw new ApiError(400, 'establishment_id must be a UUID');
    }

    const normalizedTitle = assertSafeReviewField('title', title, {
      minLength: 1,
      maxLength: REVIEW_TITLE_MAX_CHARS,
    });
    const normalizedDescription = assertSafeReviewField('description', description, {
      minLength: 1,
      maxLength: REVIEW_DESCRIPTION_MAX_CHARS,
    });

    if (!Number.isInteger(stars) || stars < 0 || stars > 5) {
      throw new ApiError(400, 'stars must be an integer between 0 and 5');
    }

    if (!isPositiveNumber(price)) {
      throw new ApiError(400, 'price must be greater than 0');
    }

    const normalizedPurchaseUrl = purchase_url == null || String(purchase_url).trim() === ''
      ? null
      : String(purchase_url).trim();
    if (normalizedPurchaseUrl != null && !isValidHttpUrl(normalizedPurchaseUrl)) {
      throw new ApiError(400, 'purchase_url must be a valid http/https URL when provided');
    }

    const normalizedTags = normalizeAndValidateTags(tags);

    if (!Array.isArray(evidence_images) || evidence_images.length < 1 || evidence_images.length > 3) {
      throw new ApiError(400, 'evidence_images must contain between 1 and 3 items');
    }

    const invalidEvidence = evidence_images.find((url) => !isNonEmptyString(url) || !isValidHttpUrl(url));
    if (invalidEvidence) {
      throw new ApiError(400, 'evidence_images must contain valid http/https URLs');
    }

    const captchaPolicy = await reviewService.shouldRequireReviewCaptcha(user_id);
    if (captchaPolicy.required) {
      if (!isNonEmptyString(captcha_token) || !isNonEmptyString(captcha_answer)) {
        throw new ApiError(400, 'captcha_token and captcha_answer are required for immediate subsequent reviews');
      }
      const check = verifyReviewCaptchaAnswer({
        userId: user_id,
        token: captcha_token,
        answer: captcha_answer,
      });
      if (!check.ok) {
        throw new ApiError(400, 'invalid captcha');
      }
    }

    const idempotencyKey = req.header('Idempotency-Key') || null;

    const review = await reviewService.createReview({
      review_id,
      review_hash,
      review_timestamp: parsedReviewTimestamp.toISOString(),
      tx_hash,
      user_id,
      establishment_id,
      title: normalizedTitle,
      description: normalizedDescription,
      stars,
      price,
      purchase_url: normalizedPurchaseUrl,
      tags: normalizedTags,
      evidence_images,
      idempotencyKey,
    });

    res.status(201).json(review);
  } catch (err) {
    next(err);
  }
}

async function createReviewSubmission(req, res, next) {
  try {
    const {
      review_id,
      review_hash,
      review_timestamp,
      user_id,
      establishment_id,
      title,
      description,
      stars,
      price,
      purchase_url,
      tags,
      evidence_images,
      signature,
      signature_nonce,
      signature_deadline,
      captcha_token,
      captcha_answer,
    } = req.body || {};

    if (!isValidUuid(review_id)) {
      throw new ApiError(400, 'review_id must be a UUID');
    }
    if (!isNonEmptyString(review_hash) || !/^0x[a-fA-F0-9]{64}$/.test(review_hash)) {
      throw new ApiError(400, 'review_hash must be a 32-byte hex string');
    }
    const parsedReviewTimestamp = new Date(review_timestamp);
    if (!review_timestamp || Number.isNaN(parsedReviewTimestamp.getTime())) {
      throw new ApiError(400, 'review_timestamp must be a valid datetime');
    }
    const parsedDeadline = new Date(signature_deadline);
    if (!signature_deadline || Number.isNaN(parsedDeadline.getTime())) {
      throw new ApiError(400, 'signature_deadline must be a valid datetime');
    }
    if (parsedDeadline.getTime() <= Date.now()) {
      throw new ApiError(400, 'signature_deadline has expired');
    }
    if (!isNonEmptyString(signature_nonce)) {
      throw new ApiError(400, 'signature_nonce is required');
    }
    if (!isNonEmptyString(signature)) {
      throw new ApiError(400, 'signature is required');
    }

    if (!isValidUuid(user_id)) {
      throw new ApiError(400, 'user_id must be a UUID');
    }
    if (req.auth?.sub !== user_id) {
      throw new ApiError(403, 'user_id does not match authenticated user');
    }
    if (!isValidUuid(establishment_id)) {
      throw new ApiError(400, 'establishment_id must be a UUID');
    }

    const normalizedTitle = assertSafeReviewField('title', title, {
      minLength: 1,
      maxLength: REVIEW_TITLE_MAX_CHARS,
    });
    const normalizedDescription = assertSafeReviewField('description', description, {
      minLength: 1,
      maxLength: REVIEW_DESCRIPTION_MAX_CHARS,
    });
    if (!Number.isInteger(stars) || stars < 0 || stars > 5) {
      throw new ApiError(400, 'stars must be an integer between 0 and 5');
    }
    if (!isPositiveNumber(price)) {
      throw new ApiError(400, 'price must be greater than 0');
    }

    const normalizedPurchaseUrl = purchase_url == null || String(purchase_url).trim() === ''
      ? null
      : String(purchase_url).trim();
    if (normalizedPurchaseUrl != null && !isValidHttpUrl(normalizedPurchaseUrl)) {
      throw new ApiError(400, 'purchase_url must be a valid http/https URL when provided');
    }

    const normalizedTags = normalizeAndValidateTags(tags);
    if (!Array.isArray(evidence_images) || evidence_images.length < 1 || evidence_images.length > 3) {
      throw new ApiError(400, 'evidence_images must contain between 1 and 3 items');
    }
    const invalidEvidence = evidence_images.find((url) => !isNonEmptyString(url) || !isValidHttpUrl(url));
    if (invalidEvidence) {
      throw new ApiError(400, 'evidence_images must contain valid http/https URLs');
    }

    const user = await findUserById(user_id);
    if (!user || !isNonEmptyString(user.wallet_address)) {
      throw new ApiError(400, 'user wallet address not found');
    }

    const typedData = buildReviewSubmissionTypedData({
      review_id,
      user_id,
      establishment_id,
      review_hash,
      signature_nonce,
      signature_deadline: parsedDeadline.toISOString(),
    });
    const recovered = ethers.verifyTypedData(
      typedData.domain,
      { ReviewSubmission: typedData.types.ReviewSubmission },
      typedData.message,
      signature
    );
    if (String(recovered || '').toLowerCase() !== String(user.wallet_address).toLowerCase()) {
      throw new ApiError(400, 'signature does not match user wallet');
    }

    const captchaPolicy = await reviewService.shouldRequireReviewCaptcha(user_id);
    if (captchaPolicy.required) {
      if (!isNonEmptyString(captcha_token) || !isNonEmptyString(captcha_answer)) {
        throw new ApiError(400, 'captcha_token and captcha_answer are required for immediate subsequent reviews');
      }
      const check = verifyReviewCaptchaAnswer({
        userId: user_id,
        token: captcha_token,
        answer: captcha_answer,
      });
      if (!check.ok) {
        throw new ApiError(400, 'invalid captcha');
      }
    }

    const submission = await reviewService.createReviewSubmission({
      review_id,
      review_hash,
      review_timestamp: parsedReviewTimestamp.toISOString(),
      user_id,
      establishment_id,
      title: normalizedTitle,
      description: normalizedDescription,
      stars,
      price,
      purchase_url: normalizedPurchaseUrl,
      tags: normalizedTags,
      evidence_images,
      signer_wallet: user.wallet_address,
      signature,
      signature_nonce: String(signature_nonce).trim(),
      signature_deadline: parsedDeadline.toISOString(),
    });

    res.status(201).json(submission);
  } catch (err) {
    next(err);
  }
}

async function getReviewCaptchaChallenge(req, res, next) {
  try {
    const userId = req.auth?.sub;
    if (!isValidUuid(userId)) {
      throw new ApiError(401, 'invalid token');
    }

    const policy = await reviewService.shouldRequireReviewCaptcha(userId);
    const requiresCaptcha = policy.required;

    if (!requiresCaptcha) {
      res.status(200).json({
        requires_captcha: false,
        reviews_count: policy.reviewsCount,
        cooldown_minutes: policy.cooldownMinutes,
      });
      return;
    }

    const challenge = buildReviewCaptchaChallenge({ userId });
    res.status(200).json({
      requires_captcha: true,
      reviews_count: policy.reviewsCount,
      cooldown_minutes: policy.cooldownMinutes,
      challenge: challenge.question,
      captcha_token: challenge.token,
      captcha_expires_at: challenge.expires_at,
    });
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

async function saveReviewAnchorTx(req, res, next) {
  try {
    const { id } = req.params;
    const { tx_hash, chain_id, block_number, block_timestamp } = req.body || {};

    if (!isValidUuid(id)) {
      throw new ApiError(400, 'id must be a UUID');
    }

    if (!isNonEmptyString(tx_hash) || !/^0x[a-fA-F0-9]{64}$/.test(tx_hash)) {
      throw new ApiError(400, 'tx_hash must be a valid transaction hash');
    }

    const normalizedChainId = chain_id == null ? null : Number(chain_id);
    if (normalizedChainId != null && (!Number.isInteger(normalizedChainId) || normalizedChainId <= 0)) {
      throw new ApiError(400, 'chain_id must be a positive integer');
    }

    const normalizedBlockNumber = block_number == null ? null : Number(block_number);
    if (normalizedBlockNumber != null && (!Number.isInteger(normalizedBlockNumber) || normalizedBlockNumber < 0)) {
      throw new ApiError(400, 'block_number must be a non-negative integer');
    }

    let normalizedBlockTimestamp = null;
    if (block_timestamp != null) {
      const parsed = new Date(block_timestamp);
      if (Number.isNaN(parsed.getTime())) {
        throw new ApiError(400, 'block_timestamp must be a valid datetime');
      }
      normalizedBlockTimestamp = parsed.toISOString();
    }

    const result = await reviewService.saveReviewAnchorTx({
      reviewId: id,
      requesterId: req.auth?.sub,
      requesterRole: req.auth?.role,
      txHash: tx_hash,
      chainId: normalizedChainId,
      blockNumber: normalizedBlockNumber,
      blockTimestamp: normalizedBlockTimestamp,
    });

    res.status(200).json(result);
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

async function getDailyReviewLimitStatus(req, res, next) {
  try {
    const userId = req.auth?.sub;
    if (!isValidUuid(userId)) {
      throw new ApiError(401, 'invalid token');
    }

    const establishmentId = String(req.query.establishment_id || '').trim();
    if (!isValidUuid(establishmentId)) {
      throw new ApiError(400, 'establishment_id must be a UUID');
    }

    const result = await reviewService.getDailyReviewLimitStatus({
      userId,
      establishmentId,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function listMyReviewStatuses(req, res, next) {
  try {
    const userId = req.auth?.sub;
    if (!isValidUuid(userId)) {
      throw new ApiError(401, 'invalid token');
    }

    const page = Number(req.query.page || 1);
    const pageSize = Number(req.query.page_size || 20);
    if (!Number.isInteger(page) || page < 1) {
      throw new ApiError(400, 'page must be a positive integer');
    }
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
      throw new ApiError(400, 'page_size must be an integer between 1 and 100');
    }

    const result = await reviewService.listMyReviewStatuses({ userId, page, pageSize });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function listPendingReviewSubmissions(req, res, next) {
  try {
    const page = Number(req.query.page || 1);
    const pageSize = Number(req.query.page_size || 20);
    const status = String(req.query.status || 'pending').trim().toLowerCase();
    const search = req.query.search == null ? '' : String(req.query.search);
    if (!Number.isInteger(page) || page < 1) {
      throw new ApiError(400, 'page must be a positive integer');
    }
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
      throw new ApiError(400, 'page_size must be an integer between 1 and 100');
    }
    if (!['pending', 'approved', 'rejected', 'all'].includes(status)) {
      throw new ApiError(400, 'status must be pending, approved, rejected, or all');
    }
    if (search.length > 150) {
      throw new ApiError(400, 'search must be at most 150 characters');
    }

    const result = await reviewService.listPendingReviewSubmissions({
      page,
      pageSize,
      status,
      search,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function approveReviewSubmission(req, res, next) {
  try {
    const { id } = req.params;
    if (!isValidUuid(id)) {
      throw new ApiError(400, 'id must be a UUID');
    }
    const actorId = req.auth?.sub;
    if (!isValidUuid(actorId)) {
      throw new ApiError(401, 'invalid token');
    }
    const result = await reviewService.approveReviewSubmission({
      submissionId: id,
      actorId,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function rejectReviewSubmission(req, res, next) {
  try {
    const { id } = req.params;
    const { reason = null } = req.body || {};
    if (!isValidUuid(id)) {
      throw new ApiError(400, 'id must be a UUID');
    }
    const actorId = req.auth?.sub;
    if (!isValidUuid(actorId)) {
      throw new ApiError(401, 'invalid token');
    }
    const normalizedReason = reason == null || String(reason).trim() === '' ? null : String(reason).trim().slice(0, 500);
    const result = await reviewService.rejectReviewSubmission({
      submissionId: id,
      actorId,
      reason: normalizedReason,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createReview,
  createReviewSubmission,
  getReviewById,
  listReviews,
  uploadReviewEvidenceImage,
  saveReviewAnchorTx,
  getReviewCaptchaChallenge,
  getDailyReviewLimitStatus,
  listMyReviewStatuses,
  listPendingReviewSubmissions,
  approveReviewSubmission,
  rejectReviewSubmission,
};
