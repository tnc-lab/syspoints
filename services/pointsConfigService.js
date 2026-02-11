const { query } = require('../db');
const { getCurrentConfig, updateConfig } = require('../repositories/pointsConfigRepository');

async function getPointsConfig() {
  return getCurrentConfig({ query });
}

async function setPointsConfig(payload) {
  return updateConfig({ query }, payload);
}

async function setDefaultUserAvatar(defaultUserAvatarUrl) {
  const current = await getCurrentConfig({ query });
  const base = current || {
    image_points_yes: 0,
    image_points_no: 0,
    description_points_gt_200: 0,
    description_points_lte_200: 0,
    stars_points_yes: 0,
    stars_points_no: 0,
    price_points_lt_100: 0,
    price_points_gte_100: 0,
  };

  return updateConfig(
    { query },
    {
      image_points_yes: Number(base.image_points_yes ?? 0),
      image_points_no: Number(base.image_points_no ?? 0),
      description_points_gt_200: Number(base.description_points_gt_200 ?? 0),
      description_points_lte_200: Number(base.description_points_lte_200 ?? 0),
      stars_points_yes: Number(base.stars_points_yes ?? 0),
      stars_points_no: Number(base.stars_points_no ?? 0),
      price_points_lt_100: Number(base.price_points_lt_100 ?? 0),
      price_points_gte_100: Number(base.price_points_gte_100 ?? 0),
      default_user_avatar_url: defaultUserAvatarUrl,
    }
  );
}

module.exports = {
  pointsConfigService: {
    getPointsConfig,
    setPointsConfig,
    setDefaultUserAvatar,
  },
};
