const path = require('path');
const fs = require('fs/promises');
const crypto = require('crypto');
const { pointsConfigService } = require('../services/pointsConfigService');
const { ApiError } = require('../middlewares/errorHandler');
const { isNonEmptyString, isValidUrl } = require('../utils/validation');
const { getUploadDir, buildPublicUploadUrl } = require('../utils/uploadStorage');

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

    const uploadDir = getUploadDir('config');
    await fs.mkdir(uploadDir, { recursive: true });
    await fs.writeFile(path.join(uploadDir, fileName), buffer);

    const avatarUrl = buildPublicUploadUrl(req, 'config', fileName);
    const updated = await pointsConfigService.setDefaultUserAvatar(avatarUrl);
    res.status(201).json({ default_user_avatar_url: updated?.default_user_avatar_url || avatarUrl });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getPointsConfig,
  updatePointsConfig,
  uploadDefaultAvatar,
};
