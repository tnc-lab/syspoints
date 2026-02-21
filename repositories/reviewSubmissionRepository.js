async function createSubmission(client, payload) {
  const result = await client.query(
    `INSERT INTO review_submissions (
      id,
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
      review_timestamp,
      signer_wallet,
      signature,
      signature_nonce,
      signature_deadline,
      moderation_status
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'pending'
    )
    RETURNING *`,
    [
      payload.id,
      payload.user_id,
      payload.establishment_id,
      payload.title,
      payload.description,
      payload.stars,
      payload.price,
      payload.purchase_url,
      payload.tags,
      payload.evidence_images,
      payload.review_hash,
      payload.review_timestamp,
      payload.signer_wallet,
      payload.signature,
      payload.signature_nonce,
      payload.signature_deadline,
    ]
  );
  return result.rows[0] || null;
}

async function findById(dbClient, id) {
  const result = await dbClient.query(
    `SELECT *
     FROM review_submissions
     WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

async function findByReviewHash(dbClient, reviewHash) {
  const result = await dbClient.query(
    `SELECT *
     FROM review_submissions
     WHERE lower(review_hash) = lower($1)
     LIMIT 1`,
    [reviewHash]
  );
  return result.rows[0] || null;
}

async function listByUser(dbClient, userId, { limit = 50, offset = 0 } = {}) {
  const result = await dbClient.query(
    `SELECT *
     FROM review_submissions
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  return result.rows;
}

async function listPending(dbClient, { limit = 50, offset = 0 } = {}) {
  const result = await dbClient.query(
    `SELECT *
     FROM review_submissions
     WHERE moderation_status = 'pending'
     ORDER BY created_at ASC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return result.rows;
}

async function listForModeration(
  dbClient,
  { status = 'pending', search = '', limit = 50, offset = 0 } = {}
) {
  const whereParts = [];
  const values = [];

  if (status && status !== 'all') {
    values.push(status);
    whereParts.push(`moderation_status = $${values.length}`);
  }

  if (search && String(search).trim()) {
    values.push(`%${String(search).trim()}%`);
    const patternIndex = values.length;
    whereParts.push(
      `(title ILIKE $${patternIndex}
      OR description ILIKE $${patternIndex}
      OR array_to_string(tags, ' ') ILIKE $${patternIndex}
      OR review_hash ILIKE $${patternIndex}
      OR user_id::text ILIKE $${patternIndex}
      OR establishment_id::text ILIKE $${patternIndex})`
    );
  }

  const whereClause = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
  values.push(limit, offset);
  const limitIndex = values.length - 1;
  const offsetIndex = values.length;

  const rowsResult = await dbClient.query(
    `SELECT *
     FROM review_submissions
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
    values
  );

  const countValues = values.slice(0, values.length - 2);
  const countResult = await dbClient.query(
    `SELECT COUNT(*)::int AS total
     FROM review_submissions
     ${whereClause}`,
    countValues
  );

  return {
    rows: rowsResult.rows,
    total: countResult.rows[0]?.total || 0,
  };
}

async function markRejected(dbClient, {
  submissionId,
  actorId,
  reason = null,
}) {
  const result = await dbClient.query(
    `UPDATE review_submissions
     SET moderation_status = 'rejected',
         moderation_reason = $3,
         moderated_by = $2,
         moderated_at = NOW()
     WHERE id = $1 AND moderation_status = 'pending'
     RETURNING *`,
    [submissionId, actorId, reason]
  );
  return result.rows[0] || null;
}

async function markApproved(dbClient, {
  submissionId,
  actorId,
  approvedReviewId,
  txHash,
  chainId,
  blockNumber,
  blockTimestamp,
}) {
  const result = await dbClient.query(
    `UPDATE review_submissions
     SET moderation_status = 'approved',
         moderated_by = $2,
         moderated_at = NOW(),
         approved_review_id = $3,
         approval_tx_hash = $4,
         approval_chain_id = $5,
         approval_block_number = $6,
         approval_block_timestamp = $7
     WHERE id = $1 AND moderation_status = 'pending'
     RETURNING *`,
    [
      submissionId,
      actorId,
      approvedReviewId,
      txHash,
      chainId,
      blockNumber,
      blockTimestamp,
    ]
  );
  return result.rows[0] || null;
}

module.exports = {
  createSubmission,
  findById,
  findByReviewHash,
  listByUser,
  listPending,
  listForModeration,
  markRejected,
  markApproved,
};
