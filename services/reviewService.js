const { withTransaction, query } = require('../db');
const {
  createReview,
  findById,
  findCoreById,
  upsertReviewAnchor,
  listReviews: listReviewsRepo,
  countByUserId,
  findLatestByUserId,
  countByUserAndEstablishmentBetween,
} = require('../repositories/reviewRepository');
const { findById: findUserById } = require('../repositories/userRepository');
const { createEvidenceBatch } = require('../repositories/reviewEvidenceRepository');
const {
  createSubmission,
  findById: findSubmissionById,
  findByReviewHash,
  listByUser: listSubmissionsByUser,
  listForModeration,
  markRejected,
  markApproved,
} = require('../repositories/reviewSubmissionRepository');
const { establishmentService } = require('./establishmentService');
const { verifyAnchoredReviewTx, anchorApprovedReviewOnChain } = require('./syscoinService');
const { ApiError } = require('../middlewares/errorHandler');
const { hashReviewPayload } = require('../utils/hash');
const { getCurrentConfig } = require('../repositories/pointsConfigRepository');
const { findByUserAndKey, saveResponse } = require('../repositories/idempotencyRepository');

const idempotencyCache = new Map();
const DEFAULT_MAX_REVIEW_TAGS = 5;
const DEFAULT_DAILY_REVIEW_LIMIT = 1;

function getUtcDayRange(referenceDateInput) {
  const referenceDate = referenceDateInput ? new Date(referenceDateInput) : new Date();
  const year = referenceDate.getUTCFullYear();
  const month = referenceDate.getUTCMonth();
  const day = referenceDate.getUTCDate();
  const start = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, day + 1, 0, 0, 0, 0));
  return { start: start.toISOString(), end: end.toISOString() };
}

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
    user_wallet_address: reviewRow.user_wallet_address || '',
    user_name: reviewRow.user_name || '',
    user_avatar_url: reviewRow.user_avatar_url || '',
    user_leaderboard_display_mode: reviewRow.user_leaderboard_display_mode || 'wallet',
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
  idempotencyKey,
}) {
  if (!/^[0-9a-fA-F-]{36}$/.test(String(review_id || ''))) {
    throw new ApiError(400, 'review_id must be a UUID');
  }
  if (!/^0x[a-fA-F0-9]{64}$/.test(String(review_hash || ''))) {
    throw new ApiError(400, 'review_hash must be a 32-byte hex string');
  }
  if (!/^0x[a-fA-F0-9]{64}$/.test(String(tx_hash || ''))) {
    throw new ApiError(400, 'tx_hash must be a valid transaction hash');
  }
  const parsedReviewTimestamp = new Date(review_timestamp);
  if (!review_timestamp || Number.isNaN(parsedReviewTimestamp.getTime())) {
    throw new ApiError(400, 'review_timestamp must be a valid datetime');
  }

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

  const reviewId = review_id;
  const user = await findUserById(user_id);
  if (!user || !user.wallet_address) {
    throw new ApiError(400, 'user wallet address is required to verify on-chain payment');
  }

  const expectedReviewHash = hashReviewPayload({
    review_id: reviewId,
    user_id,
    establishment_id,
    timestamp: parsedReviewTimestamp.toISOString(),
    price,
  });

  if (expectedReviewHash.toLowerCase() !== String(review_hash).toLowerCase()) {
    throw new ApiError(400, 'review_hash does not match the provided review payload');
  }

  const txVerification = await verifyAnchoredReviewTx({
    txHash: tx_hash,
    expectedUserWallet: user.wallet_address,
    expectedReviewHash: review_hash,
    expectedEstablishmentId: establishment_id,
  });

  if (!txVerification.ok) {
    throw new ApiError(400, `transaction verification failed: ${txVerification.reason}`);
  }

  const config = await getCurrentConfig({ query });
  if (!config) {
    throw new ApiError(500, 'points configuration missing');
  }
  const maxReviewTags = Number(config.max_review_tags ?? DEFAULT_MAX_REVIEW_TAGS);
  if (Array.isArray(tags) && maxReviewTags > 0 && tags.length > maxReviewTags) {
    throw new ApiError(400, `tags can contain at most ${maxReviewTags} items`);
  }

  const maxDailyReviews = Number(config.max_reviews_per_establishment_per_day ?? DEFAULT_DAILY_REVIEW_LIMIT);
  if (maxDailyReviews > 0) {
    const { start, end } = getUtcDayRange(new Date());
    const reviewsToday = await countByUserAndEstablishmentBetween({ query }, {
      userId: user_id,
      establishmentId: establishment_id,
      startAt: start,
      endAt: end,
    });
    if (reviewsToday >= maxDailyReviews) {
      throw new ApiError(
        409,
        `daily review limit reached for this establishment (${maxDailyReviews} per day)`
      );
    }
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
    timestamp: parsedReviewTimestamp.toISOString(),
    price,
  };

  const computedReviewHash = hashReviewPayload(hashPayload);

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
        review_hash: computedReviewHash,
      });

      await createEvidenceBatch(client, {
        review_id: reviewId,
        evidence: evidencePayload,
      });

      await upsertReviewAnchor(client, {
        review_id: reviewId,
        tx_hash,
        chain_id: txVerification.chainId,
        block_number: txVerification.blockNumber,
        block_timestamp: txVerification.blockTimestamp,
      });

      return formatReviewResponse(reviewRow, evidence_images);
    });
  } catch (err) {
    if (err.code === '23505') {
      if (String(err.constraint || '').includes('review_anchors_tx_hash_key')) {
        throw new ApiError(409, 'tx_hash already linked to another review');
      }
      if (String(err.constraint || '').includes('reviews_pkey')) {
        throw new ApiError(409, 'review_id already exists');
      }
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

  return response;
}

async function getReviewByIdService(id) {
  const review = await findById({ query }, id);
  if (!review) return null;

  return formatReviewResponse(review, review.evidence_images || []);
}

async function listReviewsService({ page, pageSize, establishmentId, userId, sort, tag }) {
  const offset = (page - 1) * pageSize;
  const { rows, total } = await listReviewsRepo({ query }, {
    limit: pageSize,
    offset,
    establishmentId,
    userId,
    sort,
    tag,
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

async function getDailyReviewLimitStatusService({ userId, establishmentId, referenceDate = null }) {
  const config = await getCurrentConfig({ query });
  const maxDailyReviews = Number(config?.max_reviews_per_establishment_per_day ?? DEFAULT_DAILY_REVIEW_LIMIT);
  const maxPerDay = maxDailyReviews > 0 ? maxDailyReviews : 0;
  if (maxPerDay === 0) {
    return {
      max_per_day: 0,
      reviews_today: 0,
      remaining_today: null,
      can_review_today: true,
      message: 'daily review limit is disabled',
    };
  }

  const { start, end } = getUtcDayRange(referenceDate);
  const reviewsToday = await countByUserAndEstablishmentBetween({ query }, {
    userId,
    establishmentId,
    startAt: start,
    endAt: end,
  });
  const remainingToday = Math.max(0, maxPerDay - reviewsToday);
  const canReviewToday = remainingToday > 0;

  return {
    max_per_day: maxPerDay,
    reviews_today: reviewsToday,
    remaining_today: remainingToday,
    can_review_today: canReviewToday,
    message: canReviewToday
      ? `you can still post ${remainingToday} review(s) today for this establishment`
      : `daily limit reached (${maxPerDay} per day for this establishment)`,
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

function formatSubmissionResponse(row) {
  if (!row) return null;
  return {
    id: row.id,
    user_id: row.user_id,
    establishment_id: row.establishment_id,
    title: row.title,
    description: row.description,
    stars: row.stars,
    price: Number(row.price),
    purchase_url: row.purchase_url,
    tags: row.tags,
    evidence_images: row.evidence_images,
    review_hash: row.review_hash,
    review_timestamp: row.review_timestamp,
    moderation_status: row.moderation_status,
    moderation_reason: row.moderation_reason || null,
    moderated_by: row.moderated_by || null,
    moderated_at: row.moderated_at || null,
    approved_review_id: row.approved_review_id || null,
    approval_tx_hash: row.approval_tx_hash || null,
    approval_chain_id: row.approval_chain_id != null ? Number(row.approval_chain_id) : null,
    approval_block_number: row.approval_block_number != null ? Number(row.approval_block_number) : null,
    approval_block_timestamp: row.approval_block_timestamp || null,
    created_at: row.created_at,
  };
}

async function createReviewSubmissionService(payload) {
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
    signer_wallet,
    signature,
    signature_nonce,
    signature_deadline,
  } = payload;

  const parsedReviewTimestamp = new Date(review_timestamp);
  if (Number.isNaN(parsedReviewTimestamp.getTime())) {
    throw new ApiError(400, 'review_timestamp must be a valid datetime');
  }
  const parsedSignatureDeadline = new Date(signature_deadline);
  if (Number.isNaN(parsedSignatureDeadline.getTime())) {
    throw new ApiError(400, 'signature_deadline must be a valid datetime');
  }

  const expectedReviewHash = hashReviewPayload({
    review_id,
    user_id,
    establishment_id,
    timestamp: parsedReviewTimestamp.toISOString(),
    price,
  });
  if (String(expectedReviewHash).toLowerCase() !== String(review_hash).toLowerCase()) {
    throw new ApiError(400, 'review_hash does not match the provided review payload');
  }

  const existingByHash = await findByReviewHash({ query }, review_hash);
  if (existingByHash) {
    throw new ApiError(409, 'review_hash already submitted');
  }

  const config = await getCurrentConfig({ query });
  const maxReviewTags = Number(config?.max_review_tags ?? DEFAULT_MAX_REVIEW_TAGS);
  if (Array.isArray(tags) && maxReviewTags > 0 && tags.length > maxReviewTags) {
    throw new ApiError(400, `tags can contain at most ${maxReviewTags} items`);
  }

  const maxDailyReviews = Number(config?.max_reviews_per_establishment_per_day ?? DEFAULT_DAILY_REVIEW_LIMIT);
  if (maxDailyReviews > 0) {
    const { start, end } = getUtcDayRange(new Date());
    const reviewsToday = await countByUserAndEstablishmentBetween({ query }, {
      userId: user_id,
      establishmentId: establishment_id,
      startAt: start,
      endAt: end,
    });
    const submissionsTodayResult = await query(
      `SELECT COUNT(*)::int AS total
       FROM review_submissions
       WHERE user_id = $1
         AND establishment_id = $2
         AND moderation_status = 'pending'
         AND created_at >= $3
         AND created_at < $4`,
      [user_id, establishment_id, start, end]
    );
    const submissionsToday = submissionsTodayResult.rows[0]?.total || 0;
    if ((reviewsToday + submissionsToday) >= maxDailyReviews) {
      throw new ApiError(
        409,
        `daily review limit reached for this establishment (${maxDailyReviews} per day)`
      );
    }
  }

  try {
    const row = await withTransaction(async (client) =>
      createSubmission(client, {
        id: review_id,
        user_id,
        establishment_id,
        title,
        description,
        stars,
        price,
        purchase_url,
        tags,
        evidence_images,
        review_hash,
        review_timestamp: parsedReviewTimestamp.toISOString(),
        signer_wallet,
        signature,
        signature_nonce,
        signature_deadline: parsedSignatureDeadline.toISOString(),
      })
    );
    return formatSubmissionResponse(row);
  } catch (err) {
    if (err.code === '23505') {
      if (String(err.constraint || '').includes('review_submissions_pkey')) {
        throw new ApiError(409, 'review_id already submitted');
      }
      if (String(err.constraint || '').includes('review_submissions_review_hash_key')) {
        throw new ApiError(409, 'review_hash already submitted');
      }
      if (String(err.constraint || '').includes('review_submissions_nonce_unique')) {
        throw new ApiError(409, 'signature nonce already used');
      }
    }
    if (err.code === '23514' || err.code === '23502') {
      throw new ApiError(400, 'invalid review submission');
    }
    throw err;
  }
}

async function listMyReviewStatusesService({ userId, page = 1, pageSize = 20 }) {
  const offset = (page - 1) * pageSize;
  const submissions = await listSubmissionsByUser({ query }, userId, {
    limit: pageSize,
    offset,
  });
  return {
    data: submissions.map(formatSubmissionResponse),
    meta: { page, page_size: pageSize, total: submissions.length + offset },
  };
}

async function listPendingReviewSubmissionsService({
  page = 1,
  pageSize = 20,
  status = 'pending',
  search = '',
}) {
  const offset = (page - 1) * pageSize;
  const normalizedStatus = String(status || 'pending').toLowerCase();
  if (!['pending', 'approved', 'rejected', 'all'].includes(normalizedStatus)) {
    throw new ApiError(400, 'status must be pending, approved, rejected, or all');
  }

  const { rows, total } = await listForModeration(
    { query },
    {
      status: normalizedStatus,
      search,
      limit: pageSize,
      offset,
    }
  );

  return {
    data: rows.map(formatSubmissionResponse),
    meta: { page, page_size: pageSize, total },
  };
}

async function rejectReviewSubmissionService({ submissionId, actorId, reason = null }) {
  const updated = await markRejected({ query }, {
    submissionId,
    actorId,
    reason,
  });
  if (!updated) {
    throw new ApiError(409, 'submission is not pending or was not found');
  }
  return formatSubmissionResponse(updated);
}

async function approveReviewSubmissionService({ submissionId, actorId }) {
  const submission = await findSubmissionById({ query }, submissionId);
  if (!submission) throw new ApiError(404, 'review submission not found');
  if (submission.moderation_status !== 'pending') {
    throw new ApiError(409, 'submission is not pending');
  }

  const user = await findUserById(submission.user_id);
  if (!user || !user.wallet_address) {
    throw new ApiError(400, 'submission user wallet not found');
  }

  const onChain = await anchorApprovedReviewOnChain({
    userWallet: user.wallet_address,
    reviewHash: submission.review_hash,
    establishmentId: submission.establishment_id,
  });

  const config = await getCurrentConfig({ query });
  if (!config) {
    throw new ApiError(500, 'points configuration missing');
  }

  const pointsAwarded = computePoints({
    description: submission.description,
    stars: submission.stars,
    price: Number(submission.price),
    evidenceCount: Array.isArray(submission.evidence_images) ? submission.evidence_images.length : 0,
    config,
  });

  const response = await withTransaction(async (client) => {
    const reviewRow = await createReview(client, {
      id: submission.id,
      user_id: submission.user_id,
      establishment_id: submission.establishment_id,
      title: submission.title,
      description: submission.description,
      stars: submission.stars,
      price: Number(submission.price),
      purchase_url: submission.purchase_url,
      tags: submission.tags,
      points_awarded: pointsAwarded,
      review_hash: submission.review_hash,
    });

    const evidencePayload = (submission.evidence_images || []).map((imageUrl) => ({
      image_url: imageUrl,
    }));
    await createEvidenceBatch(client, {
      review_id: submission.id,
      evidence: evidencePayload,
    });

    await upsertReviewAnchor(client, {
      review_id: submission.id,
      tx_hash: onChain.txHash,
      chain_id: onChain.chainId,
      block_number: onChain.blockNumber,
      block_timestamp: onChain.blockTimestamp,
    });

    const updatedSubmission = await markApproved(client, {
      submissionId: submission.id,
      actorId,
      approvedReviewId: submission.id,
      txHash: onChain.txHash,
      chainId: onChain.chainId,
      blockNumber: onChain.blockNumber,
      blockTimestamp: onChain.blockTimestamp,
    });

    return {
      review: formatReviewResponse(reviewRow, submission.evidence_images || []),
      submission: formatSubmissionResponse(updatedSubmission),
    };
  });

  return response;
}

module.exports = {
  reviewService: {
    createReview: createReviewService,
    createReviewSubmission: createReviewSubmissionService,
    listMyReviewStatuses: listMyReviewStatusesService,
    listPendingReviewSubmissions: listPendingReviewSubmissionsService,
    approveReviewSubmission: approveReviewSubmissionService,
    rejectReviewSubmission: rejectReviewSubmissionService,
    getReviewById: getReviewByIdService,
    listReviews: listReviewsService,
    saveReviewAnchorTx: saveReviewAnchorTxService,
    countReviewsByUserId: countReviewsByUserIdService,
    shouldRequireReviewCaptcha: shouldRequireReviewCaptchaService,
    getDailyReviewLimitStatus: getDailyReviewLimitStatusService,
  },
};
