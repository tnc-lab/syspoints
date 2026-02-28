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
      default_user_avatar_url,
      metamask_wallet_logo_url,
      pali_wallet_logo_url,
      other_wallet_logo_url,
      max_reviews_per_establishment_per_day,
      max_review_tags,
      search_saved_establishments_enabled,
      allow_global_category_search,
      require_profile_completion,
      i18n_translations_json
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
      default_user_avatar_url,
      metamask_wallet_logo_url,
      pali_wallet_logo_url,
      other_wallet_logo_url,
      max_reviews_per_establishment_per_day,
      max_review_tags,
      search_saved_establishments_enabled,
      allow_global_category_search,
      require_profile_completion,
      i18n_translations_json
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
     RETURNING
      image_points_yes,
      image_points_no,
      description_points_gt_200,
      description_points_lte_200,
      stars_points_yes,
      stars_points_no,
      price_points_lt_100,
      price_points_gte_100,
      default_user_avatar_url,
      metamask_wallet_logo_url,
      pali_wallet_logo_url,
      other_wallet_logo_url,
      max_reviews_per_establishment_per_day,
      max_review_tags,
      search_saved_establishments_enabled,
      allow_global_category_search,
      require_profile_completion,
      i18n_translations_json`,
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
      payload.metamask_wallet_logo_url || null,
      payload.pali_wallet_logo_url || null,
      payload.other_wallet_logo_url || null,
      payload.max_reviews_per_establishment_per_day,
      payload.max_review_tags,
      Boolean(payload.search_saved_establishments_enabled),
      Boolean(payload.allow_global_category_search),
      Boolean(payload.require_profile_completion),
      payload.i18n_translations_json || null,
    ]
  );

  return result.rows[0];
}

module.exports = {
  getCurrentConfig,
  updateConfig,
};
