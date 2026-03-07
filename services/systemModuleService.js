const crypto = require('crypto');
const { query } = require('../db');
const {
  listModules,
  listActiveModules,
  findByModuleKey,
  insertModule,
  activateModule,
  deactivateModule,
} = require('../repositories/systemModuleRepository');
const { ApiError } = require('../middlewares/errorHandler');
const { extractManifestFromZipBuffer, saveModuleArchive } = require('./moduleArchiveService');

const MODULE_ENGINE = 'syspoints-module-v1';
const REVIEW_SHARE_MODULE_KEY = 'review-share@1.0.0';
const REVIEW_SHARE_PLATFORMS = ['telegram', 'x', 'whatsapp', 'linkedin', 'facebook', 'instagram'];

const MODULE_NAME_REGEX = /^[a-z0-9][a-z0-9._-]{1,49}$/;
const MODULE_VERSION_REGEX = /^\d+\.\d+\.\d+$/;
const MODULE_RULE_ID_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9._-]{1,63}$/;
const ALLOWED_MANIFEST_KEYS = new Set([
  'name',
  'version',
  'description',
  'engine',
  'execution_order',
  'permissions',
  'hooks',
]);
const ALLOWED_PERMISSION_VALUES = new Set(['points:adjust', 'review:share']);
const ALLOWED_HOOK_KEYS = new Set(['points_adjustments', 'review_share']);
const ALLOWED_RULE_KEYS = new Set(['id', 'delta', 'when']);
const ALLOWED_WHEN_KEYS = new Set([
  'stars_gte',
  'stars_lte',
  'price_gte',
  'price_lte',
  'description_length_gte',
  'description_length_lte',
  'evidence_count_gte',
  'evidence_count_lte',
  'tags_count_gte',
  'tags_count_lte',
]);
const ALLOWED_REVIEW_SHARE_HOOK_KEYS = new Set(['label_es', 'label_en', 'platforms']);

const MIN_EXECUTION_ORDER = 1;
const MAX_EXECUTION_ORDER = 10_000;
const MAX_RULES_PER_MODULE = 50;
const MAX_POINT_DELTA = 100;
const FINAL_POINTS_MIN = 0;
const FINAL_POINTS_MAX = 1000;
const ACTIVE_MODULE_CACHE_TTL_MS = 10_000;

let activeModulesCache = {
  expiresAt: 0,
  modules: [],
};

function ensureObject(value, fieldName) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError(400, `${fieldName} must be an object`);
  }
}

function assertAllowedKeys(target, allowedKeys, fieldName) {
  Object.keys(target).forEach((key) => {
    if (!allowedKeys.has(key)) {
      throw new ApiError(400, `${fieldName}.${key} is not allowed`);
    }
  });
}

function assertIntegerInRange(value, fieldName, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new ApiError(400, `${fieldName} must be an integer between ${min} and ${max}`);
  }
}

function toCanonicalManifestJson(manifest) {
  const ordered = {
    name: manifest.name,
    version: manifest.version,
    description: manifest.description || '',
    engine: manifest.engine,
    execution_order: manifest.execution_order,
    permissions: manifest.permissions,
    hooks: manifest.hooks,
  };
  return JSON.stringify(ordered);
}

function normalizePointAdjustments(rawManifest) {
  const rules = rawManifest?.hooks?.points_adjustments;
  if (rules == null) {
    return null;
  }

  if (!Array.isArray(rules) || rules.length === 0) {
    throw new ApiError(400, 'manifest.hooks.points_adjustments must be a non-empty array when provided');
  }
  if (rules.length > MAX_RULES_PER_MODULE) {
    throw new ApiError(400, `manifest.hooks.points_adjustments must contain at most ${MAX_RULES_PER_MODULE} rules`);
  }

  const normalizedRules = rules.map((rawRule, index) => {
    ensureObject(rawRule, `manifest.hooks.points_adjustments[${index}]`);
    assertAllowedKeys(rawRule, ALLOWED_RULE_KEYS, `manifest.hooks.points_adjustments[${index}]`);

    const id = String(rawRule.id || '').trim();
    if (!MODULE_RULE_ID_REGEX.test(id)) {
      throw new ApiError(400, `manifest.hooks.points_adjustments[${index}].id is invalid`);
    }

    const delta = Number(rawRule.delta);
    assertIntegerInRange(delta, `manifest.hooks.points_adjustments[${index}].delta`, -MAX_POINT_DELTA, MAX_POINT_DELTA);

    ensureObject(rawRule.when, `manifest.hooks.points_adjustments[${index}].when`);
    assertAllowedKeys(rawRule.when, ALLOWED_WHEN_KEYS, `manifest.hooks.points_adjustments[${index}].when`);

    const when = {};
    for (const [key, value] of Object.entries(rawRule.when)) {
      if (key === 'stars_gte' || key === 'stars_lte') {
        assertIntegerInRange(value, `manifest.hooks.points_adjustments[${index}].when.${key}`, 0, 5);
      } else if (key.endsWith('_gte') || key.endsWith('_lte')) {
        assertIntegerInRange(value, `manifest.hooks.points_adjustments[${index}].when.${key}`, 0, 1000000);
      }
      when[key] = Number(value);
    }

    return { id, delta, when };
  });

  const uniqueRuleIds = new Set(normalizedRules.map((rule) => rule.id));
  if (uniqueRuleIds.size !== normalizedRules.length) {
    throw new ApiError(400, 'rule ids must be unique per module');
  }

  return normalizedRules;
}

function normalizeReviewShareHook(rawManifest) {
  const hook = rawManifest?.hooks?.review_share;
  if (hook == null) {
    return null;
  }

  ensureObject(hook, 'manifest.hooks.review_share');
  assertAllowedKeys(hook, ALLOWED_REVIEW_SHARE_HOOK_KEYS, 'manifest.hooks.review_share');

  const labelEs = String(hook.label_es || '').trim() || 'Compartir';
  const labelEn = String(hook.label_en || '').trim() || 'Share';

  const platforms = Array.isArray(hook.platforms) && hook.platforms.length > 0
    ? hook.platforms.map((value) => String(value || '').trim().toLowerCase())
    : [...REVIEW_SHARE_PLATFORMS];

  const uniquePlatforms = Array.from(new Set(platforms));
  if (!uniquePlatforms.every((platform) => REVIEW_SHARE_PLATFORMS.includes(platform))) {
    throw new ApiError(400, 'manifest.hooks.review_share.platforms contains unsupported platform');
  }

  return {
    label_es: labelEs,
    label_en: labelEn,
    platforms: uniquePlatforms,
  };
}

function normalizeAndValidateManifest(rawManifest) {
  ensureObject(rawManifest, 'manifest');
  assertAllowedKeys(rawManifest, ALLOWED_MANIFEST_KEYS, 'manifest');

  const name = String(rawManifest.name || '').trim();
  if (!MODULE_NAME_REGEX.test(name)) {
    throw new ApiError(400, 'manifest.name must be lowercase slug format (2-50 chars)');
  }

  const version = String(rawManifest.version || '').trim();
  if (!MODULE_VERSION_REGEX.test(version)) {
    throw new ApiError(400, 'manifest.version must follow semver core format (example: 1.0.0)');
  }

  const description = String(rawManifest.description || '').trim();
  if (description.length > 200) {
    throw new ApiError(400, 'manifest.description must be at most 200 chars');
  }

  const engine = String(rawManifest.engine || '').trim();
  if (engine !== MODULE_ENGINE) {
    throw new ApiError(400, `manifest.engine must be ${MODULE_ENGINE}`);
  }

  const executionOrder = rawManifest.execution_order == null
    ? 100
    : Number(rawManifest.execution_order);
  assertIntegerInRange(executionOrder, 'manifest.execution_order', MIN_EXECUTION_ORDER, MAX_EXECUTION_ORDER);

  if (!Array.isArray(rawManifest.permissions) || rawManifest.permissions.length === 0) {
    throw new ApiError(400, 'manifest.permissions must be a non-empty array');
  }
  const permissions = Array.from(new Set(rawManifest.permissions.map((value) => String(value || '').trim())));
  if (!permissions.every((value) => ALLOWED_PERMISSION_VALUES.has(value))) {
    throw new ApiError(400, 'manifest.permissions contains unsupported permission');
  }

  ensureObject(rawManifest.hooks, 'manifest.hooks');
  assertAllowedKeys(rawManifest.hooks, ALLOWED_HOOK_KEYS, 'manifest.hooks');

  const normalizedPointRules = normalizePointAdjustments(rawManifest);
  const normalizedReviewShareHook = normalizeReviewShareHook(rawManifest);

  if (!normalizedPointRules && !normalizedReviewShareHook) {
    throw new ApiError(400, 'manifest.hooks must include at least one supported hook');
  }

  if (permissions.includes('points:adjust') && !normalizedPointRules) {
    throw new ApiError(400, 'permission points:adjust requires hooks.points_adjustments');
  }
  if (permissions.includes('review:share') && !normalizedReviewShareHook) {
    throw new ApiError(400, 'permission review:share requires hooks.review_share');
  }

  const normalizedHooks = {};
  if (normalizedPointRules) {
    normalizedHooks.points_adjustments = normalizedPointRules;
  }
  if (normalizedReviewShareHook) {
    normalizedHooks.review_share = normalizedReviewShareHook;
  }

  return {
    name,
    version,
    description,
    engine,
    execution_order: executionOrder,
    permissions,
    hooks: normalizedHooks,
  };
}

function ruleMatches(rule, context) {
  const when = rule.when || {};
  if (when.stars_gte != null && context.stars < when.stars_gte) return false;
  if (when.stars_lte != null && context.stars > when.stars_lte) return false;
  if (when.price_gte != null && context.price < when.price_gte) return false;
  if (when.price_lte != null && context.price > when.price_lte) return false;
  if (when.description_length_gte != null && context.description_length < when.description_length_gte) return false;
  if (when.description_length_lte != null && context.description_length > when.description_length_lte) return false;
  if (when.evidence_count_gte != null && context.evidence_count < when.evidence_count_gte) return false;
  if (when.evidence_count_lte != null && context.evidence_count > when.evidence_count_lte) return false;
  if (when.tags_count_gte != null && context.tags_count < when.tags_count_gte) return false;
  if (when.tags_count_lte != null && context.tags_count > when.tags_count_lte) return false;
  return true;
}

function formatModule(row) {
  return {
    module_key: row.module_key,
    name: row.name,
    version: row.version,
    description: row.description || '',
    manifest_sha256: row.manifest_sha256,
    status: row.status,
    execution_order: Number(row.execution_order || 100),
    uploaded_by: row.uploaded_by || null,
    uploaded_at: row.uploaded_at,
    activated_at: row.activated_at || null,
    deactivated_at: row.deactivated_at || null,
    last_error: row.last_error || null,
    manifest: row.manifest_json,
  };
}

function invalidateActiveModulesCache() {
  activeModulesCache = {
    expiresAt: 0,
    modules: [],
  };
}

async function getActiveModulesCached() {
  const now = Date.now();
  if (activeModulesCache.expiresAt > now) {
    return activeModulesCache.modules;
  }

  const rows = await listActiveModules({ query });
  const modules = rows.map((row) => formatModule(row));
  activeModulesCache = {
    expiresAt: now + ACTIVE_MODULE_CACHE_TTL_MS,
    modules,
  };
  return modules;
}

async function listAllModules() {
  const rows = await listModules({ query });
  return rows.map((row) => formatModule(row));
}

async function uploadModule({ manifest, uploadedBy }) {
  const normalizedManifest = normalizeAndValidateManifest(manifest);
  const canonicalJson = toCanonicalManifestJson(normalizedManifest);
  const manifestSha256 = crypto.createHash('sha256').update(canonicalJson).digest('hex');

  const moduleKey = `${normalizedManifest.name}@${normalizedManifest.version}`;
  const existing = await findByModuleKey({ query }, moduleKey);
  if (existing) {
    throw new ApiError(409, 'module already exists for this name/version');
  }

  try {
    const created = await insertModule({ query }, {
      module_key: moduleKey,
      name: normalizedManifest.name,
      version: normalizedManifest.version,
      description: normalizedManifest.description,
      manifest_json: normalizedManifest,
      manifest_sha256: manifestSha256,
      status: 'inactive',
      execution_order: Number(normalizedManifest.execution_order || 100),
      uploaded_by: uploadedBy || null,
    });
    return formatModule(created);
  } catch (err) {
    if (err.code === '23505') {
      throw new ApiError(409, 'module already exists for this name/version');
    }
    if (err.code === '23514' || err.code === '23502') {
      throw new ApiError(400, 'invalid module payload');
    }
    throw err;
  }
}

async function uploadModuleArchive({ zipBuffer, uploadedBy }) {
  const manifest = await extractManifestFromZipBuffer(zipBuffer);
  const normalizedManifest = normalizeAndValidateManifest(manifest);
  const canonicalJson = toCanonicalManifestJson(normalizedManifest);
  const manifestSha256 = crypto.createHash('sha256').update(canonicalJson).digest('hex');

  const moduleKey = `${normalizedManifest.name}@${normalizedManifest.version}`;
  const existing = await findByModuleKey({ query }, moduleKey);
  if (existing) {
    throw new ApiError(409, 'module already exists for this name/version');
  }

  let archivePath = null;
  try {
    archivePath = await saveModuleArchive({ moduleKey, zipBuffer });
    const created = await insertModule({ query }, {
      module_key: moduleKey,
      name: normalizedManifest.name,
      version: normalizedManifest.version,
      description: normalizedManifest.description,
      manifest_json: normalizedManifest,
      manifest_sha256: manifestSha256,
      status: 'inactive',
      execution_order: Number(normalizedManifest.execution_order || 100),
      uploaded_by: uploadedBy || null,
    });
    return {
      ...formatModule(created),
      archive_path: archivePath,
    };
  } catch (err) {
    if (archivePath) {
      const fs = require('fs/promises');
      await fs.unlink(archivePath).catch(() => {});
    }
    if (err.code === 'EEXIST') {
      throw new ApiError(409, 'module archive already exists in modules directory');
    }
    if (err.code === '23505') {
      throw new ApiError(409, 'module already exists for this name/version');
    }
    if (err.code === '23514' || err.code === '23502') {
      throw new ApiError(400, 'invalid module payload');
    }
    throw err;
  }
}

async function activateModuleByKey(moduleKey) {
  if (!moduleKey) throw new ApiError(400, 'module key is required');
  const updated = await activateModule({ query }, moduleKey);
  if (!updated) {
    throw new ApiError(404, 'module not found');
  }
  invalidateActiveModulesCache();
  return formatModule(updated);
}

async function deactivateModuleByKey(moduleKey) {
  if (!moduleKey) throw new ApiError(400, 'module key is required');
  const updated = await deactivateModule({ query }, moduleKey);
  if (!updated) {
    throw new ApiError(404, 'module not found');
  }
  invalidateActiveModulesCache();
  return formatModule(updated);
}

async function isModuleActive(moduleKey) {
  const activeModules = await getActiveModulesCached();
  return activeModules.some((item) => item.module_key === moduleKey);
}

async function getReviewShareModuleConfig() {
  const activeModules = await getActiveModulesCached();
  const shareModule = activeModules.find((item) => item.module_key === REVIEW_SHARE_MODULE_KEY);
  if (!shareModule) {
    return {
      active: false,
      module_key: REVIEW_SHARE_MODULE_KEY,
      label_es: 'Compartir',
      label_en: 'Share',
      platforms: [...REVIEW_SHARE_PLATFORMS],
    };
  }

  return {
    active: true,
    module_key: shareModule.module_key,
    label_es: shareModule?.manifest?.hooks?.review_share?.label_es || 'Compartir',
    label_en: shareModule?.manifest?.hooks?.review_share?.label_en || 'Share',
    platforms: Array.isArray(shareModule?.manifest?.hooks?.review_share?.platforms)
      ? shareModule.manifest.hooks.review_share.platforms
      : [...REVIEW_SHARE_PLATFORMS],
  };
}

async function applyPointAdjustments({
  basePoints,
  description,
  stars,
  price,
  evidenceCount,
  tags,
}) {
  const safeBase = Number(basePoints);
  if (!Number.isFinite(safeBase)) {
    throw new ApiError(500, 'base points are invalid');
  }

  const context = {
    stars: Number(stars),
    price: Number(price),
    description_length: String(description || '').length,
    evidence_count: Number(evidenceCount || 0),
    tags_count: Array.isArray(tags) ? tags.length : 0,
  };

  const activeModules = await getActiveModulesCached();
  const appliedAdjustments = [];
  let adjustedPoints = safeBase;

  for (const mod of activeModules) {
    const rules = mod?.manifest?.hooks?.points_adjustments;
    if (!Array.isArray(rules) || rules.length === 0) continue;

    for (const rule of rules) {
      if (!ruleMatches(rule, context)) continue;
      adjustedPoints += Number(rule.delta || 0);
      appliedAdjustments.push({
        module_key: mod.module_key,
        rule_id: rule.id,
        delta: Number(rule.delta || 0),
      });
    }
  }

  if (!Number.isFinite(adjustedPoints)) {
    adjustedPoints = safeBase;
  }

  adjustedPoints = Math.max(FINAL_POINTS_MIN, Math.min(FINAL_POINTS_MAX, adjustedPoints));

  return {
    points: Math.trunc(adjustedPoints),
    applied_adjustments: appliedAdjustments,
  };
}

module.exports = {
  REVIEW_SHARE_MODULE_KEY,
  REVIEW_SHARE_PLATFORMS,
  systemModuleService: {
    listAllModules,
    uploadModule,
    uploadModuleArchive,
    activateModuleByKey,
    deactivateModuleByKey,
    isModuleActive,
    getReviewShareModuleConfig,
    applyPointAdjustments,
    normalizeAndValidateManifest,
  },
};
