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
    metamask_wallet_logo_url: null,
    pali_wallet_logo_url: null,
    other_wallet_logo_url: null,
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
      metamask_wallet_logo_url: base.metamask_wallet_logo_url || null,
      pali_wallet_logo_url: base.pali_wallet_logo_url || null,
      other_wallet_logo_url: base.other_wallet_logo_url || null,
    }
  );
}

async function setWalletLogo(walletKey, walletLogoUrl) {
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
    default_user_avatar_url: null,
    metamask_wallet_logo_url: null,
    pali_wallet_logo_url: null,
    other_wallet_logo_url: null,
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
      default_user_avatar_url: base.default_user_avatar_url || null,
      metamask_wallet_logo_url: walletKey === 'metamask' ? walletLogoUrl : (base.metamask_wallet_logo_url || null),
      pali_wallet_logo_url: walletKey === 'pali' ? walletLogoUrl : (base.pali_wallet_logo_url || null),
      other_wallet_logo_url: walletKey === 'other' ? walletLogoUrl : (base.other_wallet_logo_url || null),
    }
  );
}

module.exports = {
  pointsConfigService: {
    getPointsConfig,
    setPointsConfig,
    setDefaultUserAvatar,
    setWalletLogo,
  },
};
