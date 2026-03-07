const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { randomUUID } = require('crypto');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { ApiError } = require('../middlewares/errorHandler');

const execFileAsync = promisify(execFile);
const MAX_MANIFEST_BYTES = 250_000;

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

function sanitizeModuleFileName(moduleKey) {
  return String(moduleKey || '')
    .trim()
    .replace(/[^a-zA-Z0-9._@-]/g, '_')
    .slice(0, 120) || `module-${randomUUID()}`;
}

async function extractManifestFromZipBuffer(zipBuffer) {
  if (!Buffer.isBuffer(zipBuffer) || zipBuffer.length === 0) {
    throw new ApiError(400, 'zip file is required');
  }

  const tempFile = path.join(os.tmpdir(), `syspoints-module-${randomUUID()}.zip`);
  await fs.writeFile(tempFile, zipBuffer);

  try {
    const { stdout: listStdout } = await execFileAsync('unzip', ['-Z1', tempFile], { maxBuffer: 2 * 1024 * 1024 });
    const entries = String(listStdout || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    const manifestCandidates = entries.filter((entry) => {
      const normalized = entry.replace(/\\/g, '/').toLowerCase();
      if (normalized.endsWith('/')) return false;
      return normalized.endsWith('/manifest.json') || normalized.endsWith('/module.json') || normalized === 'manifest.json' || normalized === 'module.json';
    });

    if (manifestCandidates.length === 0) {
      throw new ApiError(400, 'zip must include manifest.json or module.json');
    }

    const manifestEntry = manifestCandidates.sort((a, b) => a.length - b.length)[0];
    const { stdout: manifestStdout } = await execFileAsync('unzip', ['-p', tempFile, manifestEntry], {
      maxBuffer: MAX_MANIFEST_BYTES,
      encoding: 'utf8',
    });

    const manifestText = String(manifestStdout || '').trim();
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
    if (/maxBuffer/i.test(String(error?.message || ''))) {
      throw new ApiError(400, `manifest must be <= ${MAX_MANIFEST_BYTES} bytes`);
    }
    throw new ApiError(400, 'failed to read zip manifest. Ensure unzip is available and archive is valid');
  } finally {
    await fs.unlink(tempFile).catch(() => {});
  }
}

async function saveModuleArchive({ moduleKey, zipBuffer }) {
  if (!Buffer.isBuffer(zipBuffer) || zipBuffer.length === 0) {
    throw new ApiError(400, 'zip file is required');
  }

  const baseDir = await ensureModulesBaseDir();
  const safeFileName = `${sanitizeModuleFileName(moduleKey)}.zip`;
  const archivePath = path.join(baseDir, safeFileName);

  await fs.writeFile(archivePath, zipBuffer, { flag: 'wx' });
  return archivePath;
}

module.exports = {
  getModulesBaseDir,
  ensureModulesBaseDir,
  extractManifestFromZipBuffer,
  saveModuleArchive,
};
