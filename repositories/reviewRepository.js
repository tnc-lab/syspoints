async function createReview(client, {
  id,
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
}) {
  const result = await client.query(
    `INSERT INTO reviews (
      id,
      user_id,
      establishment_id,
      title,
      description,
      stars,
      price,
      purchase_url,
      tags,
      points_awarded,
      review_hash
    )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING id, user_id, establishment_id, title, description, stars, price, purchase_url, tags, points_awarded, review_hash, created_at`,
    [
      id,
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
    ]
  );

  return result.rows[0];
}

async function findById(dbClient, id) {
  const reviewResult = await dbClient.query(
    `SELECT
      r.id,
      r.user_id,
      r.establishment_id,
      r.title,
      r.description,
      r.stars,
      r.price,
      r.purchase_url,
      r.tags,
      r.points_awarded,
      r.review_hash,
      r.created_at,
      ra.tx_hash,
      ra.chain_id,
      ra.block_number,
      ra.block_timestamp,
      ra.created_at AS tx_recorded_at
     FROM reviews r
     LEFT JOIN review_anchors ra ON ra.review_id = r.id
     WHERE r.id = $1`,
    [id]
  );

  const review = reviewResult.rows[0];
  if (!review) return null;

  const evidenceResult = await dbClient.query(
    `SELECT image_url, created_at
     FROM review_evidence
     WHERE review_id = $1
     ORDER BY created_at ASC`,
    [id]
  );

  return {
    ...review,
    evidence_images: evidenceResult.rows.map((row) => row.image_url),
  };
}

async function findCoreById(dbClient, id) {
  const result = await dbClient.query(
    `SELECT id, user_id, establishment_id, created_at, price
     FROM reviews
     WHERE id = $1`,
    [id]
  );

  return result.rows[0] || null;
}

async function upsertReviewAnchor(dbClient, {
  review_id,
  tx_hash,
  chain_id = null,
  block_number = null,
  block_timestamp = null,
}) {
  const result = await dbClient.query(
    `INSERT INTO review_anchors (review_id, tx_hash, chain_id, block_number, block_timestamp)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (review_id)
     DO UPDATE SET
       tx_hash = EXCLUDED.tx_hash,
       chain_id = EXCLUDED.chain_id,
       block_number = EXCLUDED.block_number,
       block_timestamp = EXCLUDED.block_timestamp
     RETURNING review_id, tx_hash, chain_id, block_number, block_timestamp, created_at AS tx_recorded_at`,
    [review_id, tx_hash, chain_id, block_number, block_timestamp]
  );

  return result.rows[0] || null;
}

async function listReviews(dbClient, { limit, offset, establishmentId, userId, sort, tag }) {
  const values = [];
  const whereParts = [];

  if (establishmentId) {
    values.push(establishmentId);
    whereParts.push(`r.establishment_id = $${values.length}`);
  }

  if (userId) {
    values.push(userId);
    whereParts.push(`r.user_id = $${values.length}`);
  }

  if (tag) {
    values.push(tag);
    whereParts.push(
      `EXISTS (
        SELECT 1
        FROM unnest(COALESCE(r.tags, '{}'::text[])) AS t(tag_value)
        WHERE lower(trim(t.tag_value)) = lower(trim($${values.length}))
      )`
    );
  }

  const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';

  const orderClause = sort === 'stars_desc'
    ? 'ORDER BY r.stars DESC, r.created_at DESC'
    : 'ORDER BY r.created_at DESC';

  values.push(limit, offset);
  const limitIndex = values.length - 1;
  const offsetIndex = values.length;

  const dataResult = await dbClient.query(
    `SELECT
      r.id,
      r.user_id,
      u.wallet_address AS user_wallet_address,
      u.name AS user_name,
      u.avatar_url AS user_avatar_url,
      u.leaderboard_display_mode AS user_leaderboard_display_mode,
      r.establishment_id,
      r.title,
      r.description,
      r.stars,
      r.price,
      r.purchase_url,
      r.tags,
      r.points_awarded,
      r.review_hash,
      r.created_at,
      MAX(ra.tx_hash) AS tx_hash,
      MAX(ra.chain_id) AS chain_id,
      MAX(ra.block_number) AS block_number,
      MAX(ra.block_timestamp) AS block_timestamp,
      MAX(ra.created_at) AS tx_recorded_at,
      COALESCE(
        array_agg(re.image_url ORDER BY re.created_at) FILTER (WHERE re.image_url IS NOT NULL),
        '{}'::text[]
      ) AS evidence_images
    FROM reviews r
    LEFT JOIN users u ON u.id = r.user_id
    LEFT JOIN review_evidence re ON re.review_id = r.id
    LEFT JOIN review_anchors ra ON ra.review_id = r.id
    ${whereClause}
    GROUP BY r.id, u.wallet_address, u.name, u.avatar_url, u.leaderboard_display_mode
    ${orderClause}
    LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
    values
  );

  const countResult = await dbClient.query(
    `SELECT COUNT(*)::int AS total
     FROM reviews r
     ${whereClause}`,
    values.slice(0, values.length - 2)
  );

  return { rows: dataResult.rows, total: countResult.rows[0]?.total || 0 };
}

async function countByUserId(dbClient, userId) {
  const result = await dbClient.query(
    `SELECT COUNT(*)::int AS total
     FROM reviews
     WHERE user_id = $1`,
    [userId]
  );
  return result.rows[0]?.total || 0;
}

async function findLatestByUserId(dbClient, userId) {
  const result = await dbClient.query(
    `SELECT created_at
     FROM reviews
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );
  return result.rows[0] || null;
}

async function countByUserAndEstablishmentBetween(dbClient, {
  userId,
  establishmentId,
  startAt,
  endAt,
}) {
  const result = await dbClient.query(
    `SELECT COUNT(*)::int AS total
     FROM reviews
     WHERE user_id = $1
       AND establishment_id = $2
       AND created_at >= $3
       AND created_at < $4`,
    [userId, establishmentId, startAt, endAt]
  );
  return result.rows[0]?.total || 0;
}

module.exports = {
  createReview,
  findById,
  findCoreById,
  upsertReviewAnchor,
  listReviews,
  countByUserId,
  findLatestByUserId,
  countByUserAndEstablishmentBetween,
};
