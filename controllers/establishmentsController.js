const crypto = require('crypto');
const { establishmentService } = require('../services/establishmentService');
const { uploadImageDataUrl } = require('../services/fileStorageService');
const { ApiError } = require('../middlewares/errorHandler');
const { isNonEmptyString, isValidUrl } = require('../utils/validation');

const ALLOWED_IMAGE_MIME = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const MAX_IMAGE_BYTES = 1_500_000;

async function listEstablishments(req, res, next) {
  try {
    const establishments = await establishmentService.listEstablishments();
    res.status(200).json(establishments);
  } catch (err) {
    next(err);
  }
}

async function createEstablishment(req, res, next) {
  try {
    const { name, category, image_url } = req.body || {};

    if (!isNonEmptyString(name)) {
      throw new ApiError(400, 'name is required');
    }

    if (!isNonEmptyString(category)) {
      throw new ApiError(400, 'category is required');
    }

    if (image_url != null && !isValidUrl(image_url)) {
      throw new ApiError(400, 'image_url must be a valid URL');
    }

    const establishment = await establishmentService.createEstablishment({ name, category, image_url });
    res.status(201).json(establishment);
  } catch (err) {
    next(err);
  }
}

async function updateEstablishment(req, res, next) {
  try {
    const { id } = req.params || {};
    const { name, category, image_url } = req.body || {};

    if (!isNonEmptyString(id)) {
      throw new ApiError(400, 'id is required');
    }

    if (!isNonEmptyString(name)) {
      throw new ApiError(400, 'name is required');
    }

    if (!isNonEmptyString(category)) {
      throw new ApiError(400, 'category is required');
    }

    if (image_url != null && !isValidUrl(image_url)) {
      throw new ApiError(400, 'image_url must be a valid URL');
    }

    const existing = await establishmentService.getEstablishmentById(id);
    if (!existing) {
      throw new ApiError(404, 'establishment not found');
    }

    const updated = await establishmentService.updateEstablishment({ id, name, category, image_url });
    if (!updated) {
      throw new ApiError(404, 'establishment not found');
    }
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
}

async function uploadEstablishmentImage(req, res, next) {
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
    const safeBaseName = (file_name || 'establishment').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'establishment';
    const fileName = `${safeBaseName}-${crypto.randomUUID()}.${extension}`;

    const imageUrl = await uploadImageDataUrl(req, {
      scope: 'establishments',
      fileName,
      dataUrl: data_url,
      buffer,
    });
    res.status(201).json({ image_url: imageUrl });
  } catch (err) {
    next(err);
  }
}

module.exports = { listEstablishments, createEstablishment, updateEstablishment, uploadEstablishmentImage };
