const { systemModuleService } = require('../services/systemModuleService');
const { ApiError } = require('../middlewares/errorHandler');

const ALLOWED_MODULE_MIME = new Set([
  'application/zip',
  'application/x-zip-compressed',
  'multipart/x-zip',
]);
const MAX_MODULE_ARCHIVE_BYTES = 5_000_000;

function parseModuleZipBufferFromDataUrl({ mimeType, dataUrl }) {
  const prefix = `data:${mimeType};base64,`;
  if (!String(dataUrl || '').startsWith(prefix)) {
    throw new ApiError(400, 'data_url must be a base64 data URL with matching mime_type');
  }

  const base64Payload = dataUrl.slice(prefix.length);
  const buffer = Buffer.from(base64Payload, 'base64');
  if (!buffer.length || buffer.length > MAX_MODULE_ARCHIVE_BYTES) {
    throw new ApiError(
      400,
      `module zip size must be between 1 byte and ${MAX_MODULE_ARCHIVE_BYTES} bytes`
    );
  }
  return buffer;
}

async function listModules(req, res, next) {
  try {
    const modules = await systemModuleService.listAllModules();
    res.status(200).json({ data: modules });
  } catch (err) {
    next(err);
  }
}

async function uploadModule(req, res, next) {
  try {
    const { mime_type, data_url } = req.body || {};
    const normalizedMimeType = String(mime_type || '').toLowerCase();
    if (!ALLOWED_MODULE_MIME.has(normalizedMimeType)) {
      throw new ApiError(400, 'mime_type must be application/zip or application/x-zip-compressed');
    }
    const zipBuffer = parseModuleZipBufferFromDataUrl({
      mimeType: normalizedMimeType,
      dataUrl: data_url,
    });

    const created = await systemModuleService.uploadModuleArchive({
      zipBuffer,
      uploadedBy: req.auth?.sub || null,
    });

    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
}

async function activateModule(req, res, next) {
  try {
    const moduleKey = decodeURIComponent(String(req.params?.moduleKey || '').trim());
    if (!moduleKey) {
      throw new ApiError(400, 'module key is required');
    }

    const updated = await systemModuleService.activateModuleByKey(moduleKey);
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
}

async function deactivateModule(req, res, next) {
  try {
    const moduleKey = decodeURIComponent(String(req.params?.moduleKey || '').trim());
    if (!moduleKey) {
      throw new ApiError(400, 'module key is required');
    }

    const updated = await systemModuleService.deactivateModuleByKey(moduleKey);
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listModules,
  uploadModule,
  activateModule,
  deactivateModule,
};
