async function createReview(client, {
  id,
  user_id,
  establishment_id,
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
      description,
      stars,
      price,
      purchase_url,
      tags,
      points_awarded,
      review_hash
    )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING id, user_id, establishment_id, description, stars, price, purchase_url, tags, points_awarded, review_hash, created_at`,
    [
      id,
      user_id,
      establishment_id,
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
    `SELECT id, user_id, establishment_id, description, stars, price, purchase_url, tags, points_awarded, review_hash, created_at
     FROM reviews
     WHERE id = $1`,
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

async function listReviews(dbClient, { limit, offset, establishmentId, sort }) {
  const values = [];
  let whereClause = '';

  if (establishmentId) {
    values.push(establishmentId);
    whereClause = `WHERE r.establishment_id = $${values.length}`;
  }

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
      r.establishment_id,
      r.description,
      r.stars,
      r.price,
      r.purchase_url,
      r.tags,
      r.points_awarded,
      r.review_hash,
      r.created_at,
      COALESCE(
        array_agg(re.image_url ORDER BY re.created_at) FILTER (WHERE re.image_url IS NOT NULL),
        '{}'::text[]
      ) AS evidence_images
    FROM reviews r
    LEFT JOIN review_evidence re ON re.review_id = r.id
    ${whereClause}
    GROUP BY r.id
    ${orderClause}
    LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
    values
  );

  const countResult = await dbClient.query(
    `SELECT COUNT(*)::int AS total
     FROM reviews r
     ${whereClause}`,
    establishmentId ? [establishmentId] : []
  );

  return { rows: dataResult.rows, total: countResult.rows[0]?.total || 0 };
}

module.exports = {
  createReview,
  findById,
  findCoreById,
  listReviews,
};
