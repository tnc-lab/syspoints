const crypto = require('crypto');
const { pointsConfigService } = require('../services/pointsConfigService');
const { uploadImageDataUrl } = require('../services/fileStorageService');
const { ApiError } = require('../middlewares/errorHandler');
const { isNonEmptyString, isValidUrl } = require('../utils/validation');

const FIELDS = [
  'image_points_yes',
  'image_points_no',
  'description_points_gt_200',
  'description_points_lte_200',
  'stars_points_yes',
  'stars_points_no',
  'price_points_lt_100',
  'price_points_gte_100',
];

const ALLOWED_IMAGE_MIME = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const MAX_IMAGE_BYTES = 1_500_000;
const MAX_WALLET_LOGO_BYTES = 600_000;
const ALLOWED_WALLET_KEYS = new Set(['metamask', 'pali', 'other']);

function validatePayload(payload) {
  for (const field of FIELDS) {
    if (!Number.isInteger(payload[field])) {
      return `${field} must be an integer`;
    }
  }
  if (
    payload.default_user_avatar_url != null &&
    payload.default_user_avatar_url !== '' &&
    !isValidUrl(payload.default_user_avatar_url)
  ) {
    return 'default_user_avatar_url must be a valid URL';
  }
  if (
    payload.metamask_wallet_logo_url != null &&
    payload.metamask_wallet_logo_url !== '' &&
    !isValidUrl(payload.metamask_wallet_logo_url)
  ) {
    return 'metamask_wallet_logo_url must be a valid URL';
  }
  if (
    payload.pali_wallet_logo_url != null &&
    payload.pali_wallet_logo_url !== '' &&
    !isValidUrl(payload.pali_wallet_logo_url)
  ) {
    return 'pali_wallet_logo_url must be a valid URL';
  }
  if (
    payload.other_wallet_logo_url != null &&
    payload.other_wallet_logo_url !== '' &&
    !isValidUrl(payload.other_wallet_logo_url)
  ) {
    return 'other_wallet_logo_url must be a valid URL';
  }
  return null;
}

async function getPointsConfig(req, res, next) {
  try {
    const config = await pointsConfigService.getPointsConfig();
    res.status(200).json(config || {});
  } catch (err) {
    next(err);
  }
}

async function updatePointsConfig(req, res, next) {
  try {
    const payload = req.body || {};
    const error = validatePayload(payload);
    if (error) {
      throw new ApiError(400, error);
    }

    const updated = await pointsConfigService.setPointsConfig(payload);
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
}

async function uploadDefaultAvatar(req, res, next) {
  try {
    const { file_name, mime_type, data_url } = req.body || {};

    if (!isNonEmptyString(mime_type) || !ALLOWED_IMAGE_MIME[mime_type]) {
      throw new ApiError(400, 'mime_type must be image/jpeg, image/png, or image/webp');
    }

    if (!isNonEmptyString(data_url)) {
      throw new ApiError(400, 'data_url is required');
    }

    const prefix = `data:${mime_type};base64,`;
    if (!data_url.startsWith(prefix)) {
      throw new ApiError(400, 'data_url must be a base64 data URL with matching mime_type');
    }

    const base64Payload = data_url.slice(prefix.length);
    const buffer = Buffer.from(base64Payload, 'base64');
    if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) {
      throw new ApiError(400, `image size must be between 1 byte and ${MAX_IMAGE_BYTES} bytes`);
    }

    const extension = ALLOWED_IMAGE_MIME[mime_type];
    const safeBaseName = (file_name || 'default-avatar').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'default-avatar';
    const fileName = `${safeBaseName}-${crypto.randomUUID()}.${extension}`;

    const avatarUrl = await uploadImageDataUrl(req, {
      scope: 'config',
      fileName,
      dataUrl: data_url,
      buffer,
    });
    const updated = await pointsConfigService.setDefaultUserAvatar(avatarUrl);
    res.status(201).json({ default_user_avatar_url: updated?.default_user_avatar_url || avatarUrl });
  } catch (err) {
    next(err);
  }
}

async function uploadWalletLogo(req, res, next) {
  try {
    const { wallet_key, file_name, mime_type, data_url } = req.body || {};

    if (!isNonEmptyString(wallet_key) || !ALLOWED_WALLET_KEYS.has(wallet_key)) {
      throw new ApiError(400, 'wallet_key must be one of: metamask, pali, other');
    }

    if (!isNonEmptyString(mime_type) || !ALLOWED_IMAGE_MIME[mime_type]) {
      throw new ApiError(400, 'mime_type must be image/jpeg, image/png, or image/webp');
    }

    if (!isNonEmptyString(data_url)) {
      throw new ApiError(400, 'data_url is required');
    }

    const prefix = `data:${mime_type};base64,`;
    if (!data_url.startsWith(prefix)) {
      throw new ApiError(400, 'data_url must be a base64 data URL with matching mime_type');
    }

    const base64Payload = data_url.slice(prefix.length);
    const buffer = Buffer.from(base64Payload, 'base64');
    if (!buffer.length || buffer.length > MAX_WALLET_LOGO_BYTES) {
      throw new ApiError(400, `wallet logo size must be between 1 byte and ${MAX_WALLET_LOGO_BYTES} bytes`);
    }

    const extension = ALLOWED_IMAGE_MIME[mime_type];
    const safeBaseName = (file_name || `${wallet_key}-wallet-logo`).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || `${wallet_key}-wallet-logo`;
    const fileName = `${safeBaseName}-${crypto.randomUUID()}.${extension}`;

    const walletLogoUrl = await uploadImageDataUrl(req, {
      scope: 'config',
      fileName,
      dataUrl: data_url,
      buffer,
    });

    const updated = await pointsConfigService.setWalletLogo(wallet_key, walletLogoUrl);
    return res.status(201).json({
      wallet_key,
      wallet_logo_url: walletLogoUrl,
      metamask_wallet_logo_url: updated?.metamask_wallet_logo_url || null,
      pali_wallet_logo_url: updated?.pali_wallet_logo_url || null,
      other_wallet_logo_url: updated?.other_wallet_logo_url || null,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getPointsConfig,
  updatePointsConfig,
  uploadDefaultAvatar,
  uploadWalletLogo,
};
