async function findShareByUserReviewAndPlatform(dbClient, {
  userId,
  reviewId,
  platform,
}) {
  const result = await dbClient.query(
    `SELECT id, review_id, shared_by_user_id, platform, share_points_awarded, created_at
     FROM review_shares
     WHERE shared_by_user_id = $1
       AND review_id = $2
       AND platform = $3
     LIMIT 1`,
    [userId, reviewId, platform]
  );
  return result.rows[0] || null;
}

async function createReviewShare(dbClient, {
  reviewId,
  userId,
  platform,
  sharePointsAwarded,
}) {
  const result = await dbClient.query(
    `INSERT INTO review_shares (
      review_id,
      shared_by_user_id,
      platform,
      share_points_awarded
    ) VALUES ($1,$2,$3,$4)
    RETURNING id, review_id, shared_by_user_id, platform, share_points_awarded, created_at`,
    [reviewId, userId, platform, sharePointsAwarded]
  );
  return result.rows[0] || null;
}

module.exports = {
  findShareByUserReviewAndPlatform,
  createReviewShare,
};
