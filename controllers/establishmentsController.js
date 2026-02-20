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

function parseNullableCoordinate(value, { field, min, max }) {
  if (value == null || value === '') return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < min || numeric > max) {
    throw new ApiError(400, `${field} must be a number between ${min} and ${max}`);
  }
  return numeric;
}

async function listEstablishments(req, res, next) {
  try {
    const establishments = await establishmentService.listEstablishments();
    res.status(200).json(establishments);
  } catch (err) {
    next(err);
  }
}

async function listTopReviewedEstablishments(req, res, next) {
  try {
    const page = Number(req.query.page || 1);
    const pageSize = Number(req.query.page_size || 5);

    if (!Number.isInteger(page) || page < 1) {
      throw new ApiError(400, 'page must be a positive integer');
    }

    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
      throw new ApiError(400, 'page_size must be an integer between 1 and 100');
    }

    const result = await establishmentService.listTopReviewedEstablishments({ page, pageSize });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function createEstablishment(req, res, next) {
  try {
    const { name, category, image_url, address, country, state_region, district, latitude, longitude } = req.body || {};

    if (!isNonEmptyString(name)) {
      throw new ApiError(400, 'name is required');
    }

    if (!isNonEmptyString(category)) {
      throw new ApiError(400, 'category is required');
    }

    if (image_url != null && !isValidUrl(image_url)) {
      throw new ApiError(400, 'image_url must be a valid URL');
    }

    if (address != null && !isNonEmptyString(address)) {
      throw new ApiError(400, 'address must be a non-empty string when provided');
    }
    if (country != null && !isNonEmptyString(country)) {
      throw new ApiError(400, 'country must be a non-empty string when provided');
    }
    if (state_region != null && !isNonEmptyString(state_region)) {
      throw new ApiError(400, 'state_region must be a non-empty string when provided');
    }
    if (district != null && !isNonEmptyString(district)) {
      throw new ApiError(400, 'district must be a non-empty string when provided');
    }

    const parsedLatitude = parseNullableCoordinate(latitude, { field: 'latitude', min: -90, max: 90 });
    const parsedLongitude = parseNullableCoordinate(longitude, { field: 'longitude', min: -180, max: 180 });

    const establishment = await establishmentService.createEstablishment({
      name,
      category,
      image_url,
      address: address || null,
      country: country || null,
      state_region: state_region || null,
      district: district || null,
      latitude: parsedLatitude,
      longitude: parsedLongitude,
    });
    res.status(201).json(establishment);
  } catch (err) {
    next(err);
  }
}

async function updateEstablishment(req, res, next) {
  try {
    const { id } = req.params || {};
    const { name, category, image_url, address, country, state_region, district, latitude, longitude } = req.body || {};

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

    if (address != null && !isNonEmptyString(address)) {
      throw new ApiError(400, 'address must be a non-empty string when provided');
    }
    if (country != null && !isNonEmptyString(country)) {
      throw new ApiError(400, 'country must be a non-empty string when provided');
    }
    if (state_region != null && !isNonEmptyString(state_region)) {
      throw new ApiError(400, 'state_region must be a non-empty string when provided');
    }
    if (district != null && !isNonEmptyString(district)) {
      throw new ApiError(400, 'district must be a non-empty string when provided');
    }

    const parsedLatitude = parseNullableCoordinate(latitude, { field: 'latitude', min: -90, max: 90 });
    const parsedLongitude = parseNullableCoordinate(longitude, { field: 'longitude', min: -180, max: 180 });

    const existing = await establishmentService.getEstablishmentById(id);
    if (!existing) {
      throw new ApiError(404, 'establishment not found');
    }

    const updated = await establishmentService.updateEstablishment({
      id,
      name,
      category,
      image_url,
      address: address || null,
      country: country || null,
      state_region: state_region || null,
      district: district || null,
      latitude: parsedLatitude,
      longitude: parsedLongitude,
    });
    if (!updated) {
      throw new ApiError(404, 'establishment not found');
    }
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
}

async function resolveEstablishmentFromLocation(req, res, next) {
  try {
    const { name, address, country, state_region, district, latitude, longitude, category, image_url } = req.body || {};

    if (!isNonEmptyString(name)) {
      throw new ApiError(400, 'name is required');
    }

    if (!isNonEmptyString(address)) {
      throw new ApiError(400, 'address is required');
    }
    if (country != null && !isNonEmptyString(country)) {
      throw new ApiError(400, 'country must be a non-empty string when provided');
    }
    if (state_region != null && !isNonEmptyString(state_region)) {
      throw new ApiError(400, 'state_region must be a non-empty string when provided');
    }
    if (district != null && !isNonEmptyString(district)) {
      throw new ApiError(400, 'district must be a non-empty string when provided');
    }

    if (image_url != null && !isValidUrl(image_url)) {
      throw new ApiError(400, 'image_url must be a valid URL');
    }

    const parsedLatitude = parseNullableCoordinate(latitude, { field: 'latitude', min: -90, max: 90 });
    const parsedLongitude = parseNullableCoordinate(longitude, { field: 'longitude', min: -180, max: 180 });

    if (parsedLatitude == null || parsedLongitude == null) {
      throw new ApiError(400, 'latitude and longitude are required');
    }

    const establishment = await establishmentService.resolveFromLocation({
      name: name.trim(),
      address: address.trim(),
      country: country || null,
      state_region: state_region || null,
      district: district || null,
      latitude: parsedLatitude,
      longitude: parsedLongitude,
      category: isNonEmptyString(category) ? category.trim() : 'Map Place',
      image_url: image_url || null,
    });

    res.status(200).json(establishment);
  } catch (err) {
    next(err);
  }
}

async function searchLocation(req, res, next) {
  try {
    const { query, limit, category } = req.body || {};
    if (!isNonEmptyString(query)) {
      throw new ApiError(400, 'query is required');
    }

    const maxResults = limit == null ? 6 : Number(limit);
    if (!Number.isInteger(maxResults) || maxResults < 1 || maxResults > 20) {
      throw new ApiError(400, 'limit must be an integer between 1 and 20');
    }

    const places = await establishmentService.searchLocation({
      queryText: query.trim(),
      maxResults,
      category: isNonEmptyString(category) ? String(category).trim() : null,
    });
    res.status(200).json({ data: places });
  } catch (err) {
    if (err?.code === 'OSM_SEARCH_FAILED') {
      return next(new ApiError(502, 'OSM search is unavailable'));
    }
    next(err);
  }
}

async function suggestEstablishmentImages(req, res, next) {
  try {
    const { query } = req.body || {};
    if (!isNonEmptyString(query)) {
      throw new ApiError(400, 'query is required');
    }

    const suggestions = await establishmentService.suggestImages();
    res.status(200).json({ data: suggestions });
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

module.exports = {
  listEstablishments,
  listTopReviewedEstablishments,
  createEstablishment,
  updateEstablishment,
  resolveEstablishmentFromLocation,
  searchLocation,
  suggestEstablishmentImages,
  uploadEstablishmentImage,
};
