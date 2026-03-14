const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');
const AdmZip = require('adm-zip');
const { ApiError } = require('../middlewares/errorHandler');

const MAX_MANIFEST_BYTES = 250_000;
const MAX_ZIP_ENTRY_BYTES = 5_000_000;
const MAX_ZIP_ENTRY_COUNT = 500;

function getModulesBaseDir() {
  if (process.env.MODULES_DIR) {
    return process.env.MODULES_DIR;
  }
  return path.join(process.cwd(), 'modules');
}

async function ensureModulesBaseDir() {
  await fs.mkdir(getModulesBaseDir(), { recursive: true });
  return getModulesBaseDir();
}

function sanitizeModuleFolderName(moduleKey) {
  return String(moduleKey || '')
    .trim()
    .replace(/[^a-zA-Z0-9._@-]/g, '_')
    .slice(0, 120) || `module-${randomUUID()}`;
}

function normalizeZipEntryName(entryName) {
  return String(entryName || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '');
}

function assertSafeZipEntryPath(entryName) {
  const normalized = normalizeZipEntryName(entryName);
  if (!normalized || normalized.endsWith('/')) return null;
  if (normalized.includes('..')) {
    throw new ApiError(400, `zip contains unsafe path: ${entryName}`);
  }
  if (path.isAbsolute(normalized)) {
    throw new ApiError(400, `zip contains absolute path: ${entryName}`);
  }
  return normalized;
}

function findManifestEntry(entries) {
  const candidates = entries.filter((entry) => {
    const normalized = normalizeZipEntryName(entry.entryName).toLowerCase();
    return (
      normalized.endsWith('/manifest.json') ||
      normalized.endsWith('/module.json') ||
      normalized === 'manifest.json' ||
      normalized === 'module.json'
    );
  });

  if (candidates.length === 0) {
    throw new ApiError(400, 'zip must include manifest.json or module.json');
  }

  return candidates.sort((a, b) => a.entryName.length - b.entryName.length)[0];
}

function getZipEntries(zipBuffer) {
  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries().filter((entry) => !entry.isDirectory);
  if (entries.length === 0) {
    throw new ApiError(400, 'zip is empty');
  }
  if (entries.length > MAX_ZIP_ENTRY_COUNT) {
    throw new ApiError(400, `zip contains too many files (max ${MAX_ZIP_ENTRY_COUNT})`);
  }
  return entries;
}

async function extractManifestFromZipBuffer(zipBuffer) {
  if (!Buffer.isBuffer(zipBuffer) || zipBuffer.length === 0) {
    throw new ApiError(400, 'zip file is required');
  }

  try {
    const entries = getZipEntries(zipBuffer);
    const manifestEntry = findManifestEntry(entries);
    const manifestBuffer = manifestEntry.getData();
    if (!manifestBuffer || manifestBuffer.length === 0) {
      throw new ApiError(400, 'manifest file is empty');
    }
    if (manifestBuffer.length > MAX_MANIFEST_BYTES) {
      throw new ApiError(400, `manifest must be <= ${MAX_MANIFEST_BYTES} bytes`);
    }

    const manifestText = manifestBuffer.toString('utf8').trim();
    if (!manifestText) {
      throw new ApiError(400, 'manifest file is empty');
    }

    try {
      return JSON.parse(manifestText);
    } catch {
      throw new ApiError(400, 'manifest JSON is invalid');
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, `failed to read zip manifest: ${String(error?.message || 'invalid archive')}`);
  }
}

async function saveModuleBundle({ moduleKey, zipBuffer }) {
  if (!Buffer.isBuffer(zipBuffer) || zipBuffer.length === 0) {
    throw new ApiError(400, 'zip file is required');
  }

  const baseDir = await ensureModulesBaseDir();
  const moduleFolderName = sanitizeModuleFolderName(moduleKey);
  const moduleDir = path.join(baseDir, moduleFolderName);

  await fs.mkdir(moduleDir, { recursive: false });

  try {
    const archivePath = path.join(moduleDir, 'module.zip');
    await fs.writeFile(archivePath, zipBuffer, { flag: 'wx' });

    const entries = getZipEntries(zipBuffer);
    for (const entry of entries) {
      const safeRelativePath = assertSafeZipEntryPath(entry.entryName);
      if (!safeRelativePath) continue;

      const entryBuffer = entry.getData();
      if (entryBuffer.length > MAX_ZIP_ENTRY_BYTES) {
        throw new ApiError(400, `zip entry too large: ${safeRelativePath}`);
      }

      const targetPath = path.join(moduleDir, safeRelativePath);
      const normalizedTarget = path.normalize(targetPath);
      const normalizedModuleDir = path.normalize(moduleDir + path.sep);
      if (!normalizedTarget.startsWith(normalizedModuleDir)) {
        throw new ApiError(400, `zip contains unsafe extraction path: ${safeRelativePath}`);
      }

      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, entryBuffer, { flag: 'wx' });
    }

    return {
      module_dir: moduleDir,
      archive_path: archivePath,
    };
  } catch (err) {
    await fs.rm(moduleDir, { recursive: true, force: true }).catch(() => {});
    throw err;
  }
}

module.exports = {
  getModulesBaseDir,
  ensureModulesBaseDir,
  extractManifestFromZipBuffer,
  saveModuleBundle,
};
