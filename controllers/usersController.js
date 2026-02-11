const path = require('path');
const fs = require('fs/promises');
const crypto = require('crypto');
const { userService } = require('../services/userService');
const { ApiError } = require('../middlewares/errorHandler');
const { isNonEmptyString, isValidEmail, isValidUrl } = require('../utils/validation');
const { getUploadDir, buildPublicUploadUrl } = require('../utils/uploadStorage');

const ALLOWED_AVATAR_MIME = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const MAX_AVATAR_BYTES = 1_500_000;

async function createUser(req, res, next) {
  try {
    const { wallet_address, email, name, avatar_url } = req.body || {};

    if (!isNonEmptyString(name)) {
      throw new ApiError(400, 'name is required');
    }

    if (!isNonEmptyString(avatar_url) || !isValidUrl(avatar_url)) {
      throw new ApiError(400, 'avatar_url must be a valid URL');
    }

    if (!isNonEmptyString(wallet_address) && !isNonEmptyString(email)) {
      throw new ApiError(400, 'wallet_address or email is required');
    }

    if (isNonEmptyString(email) && !isValidEmail(email)) {
      throw new ApiError(400, 'email is invalid');
    }

    const user = await userService.createUser({
      wallet_address,
      email,
      name,
      avatar_url,
    });

    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
}

async function listUsers(req, res, next) {
  try {
    const users = await userService.listUsers();
    res.status(200).json(users);
  } catch (err) {
    next(err);
  }
}

async function getMe(req, res, next) {
  try {
    const userId = req.auth?.sub;
    if (!userId) {
      throw new ApiError(401, 'invalid token');
    }

    const user = await userService.findById(userId);
    if (!user) {
      throw new ApiError(404, 'user not found');
    }

    res.status(200).json(user);
  } catch (err) {
    next(err);
  }
}

async function updateMe(req, res, next) {
  try {
    const userId = req.auth?.sub;
    if (!userId) {
      throw new ApiError(401, 'invalid token');
    }

    const { name, email, avatar_url } = req.body || {};

    if (!isNonEmptyString(name)) {
      throw new ApiError(400, 'name is required');
    }

    if (!isNonEmptyString(avatar_url) || !isValidUrl(avatar_url)) {
      throw new ApiError(400, 'avatar_url must be a valid URL');
    }

    if (email && !isValidEmail(email)) {
      throw new ApiError(400, 'email is invalid');
    }

    const updatedUser = await userService.updateUserProfile(userId, {
      name,
      email: email || null,
      avatar_url,
    });

    res.status(200).json(updatedUser);
  } catch (err) {
    next(err);
  }
}

async function uploadMyAvatar(req, res, next) {
  try {
    const userId = req.auth?.sub;
    if (!userId) {
      throw new ApiError(401, 'invalid token');
    }

    const { file_name, mime_type, data_url } = req.body || {};

    if (!isNonEmptyString(mime_type) || !ALLOWED_AVATAR_MIME[mime_type]) {
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
    if (!buffer.length || buffer.length > MAX_AVATAR_BYTES) {
      throw new ApiError(400, `image size must be between 1 byte and ${MAX_AVATAR_BYTES} bytes`);
    }

    const extension = ALLOWED_AVATAR_MIME[mime_type];
    const safeBaseName = (file_name || 'avatar').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'avatar';
    const fileName = `${safeBaseName}-${crypto.randomUUID()}.${extension}`;

    const uploadDir = getUploadDir('avatars');
    await fs.mkdir(uploadDir, { recursive: true });
    await fs.writeFile(path.join(uploadDir, fileName), buffer);

    const avatarUrl = buildPublicUploadUrl(req, 'avatars', fileName);
    res.status(201).json({ avatar_url: avatarUrl });
  } catch (err) {
    next(err);
  }
}

module.exports = { createUser, listUsers, getMe, updateMe, uploadMyAvatar };
