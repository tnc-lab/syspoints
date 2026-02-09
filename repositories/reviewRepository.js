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

module.exports = {
  createReview,
  findById,
  findCoreById,
};
