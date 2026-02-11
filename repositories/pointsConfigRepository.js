async function getCurrentConfig(dbClient) {
  const result = await dbClient.query(
    `SELECT
      image_points_yes,
      image_points_no,
      description_points_gt_200,
      description_points_lte_200,
      stars_points_yes,
      stars_points_no,
      price_points_lt_100,
      price_points_gte_100,
      default_user_avatar_url
     FROM points_config
     ORDER BY created_at DESC
     LIMIT 1`
  );

  return result.rows[0] || null;
}

async function updateConfig(dbClient, payload) {
  const result = await dbClient.query(
    `INSERT INTO points_config (
      image_points_yes,
      image_points_no,
      description_points_gt_200,
      description_points_lte_200,
      stars_points_yes,
      stars_points_no,
      price_points_lt_100,
      price_points_gte_100,
      default_user_avatar_url
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING
      image_points_yes,
      image_points_no,
      description_points_gt_200,
      description_points_lte_200,
      stars_points_yes,
      stars_points_no,
      price_points_lt_100,
      price_points_gte_100,
      default_user_avatar_url`,
    [
      payload.image_points_yes,
      payload.image_points_no,
      payload.description_points_gt_200,
      payload.description_points_lte_200,
      payload.stars_points_yes,
      payload.stars_points_no,
      payload.price_points_lt_100,
      payload.price_points_gte_100,
      payload.default_user_avatar_url || null,
    ]
  );

  return result.rows[0];
}

module.exports = {
  getCurrentConfig,
  updateConfig,
};
