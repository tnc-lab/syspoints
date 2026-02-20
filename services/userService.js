const crypto = require('crypto');
const { findByEmail, findByWallet, createUser, listUsers, findById, updateById, upsertWalletForUser } = require('../repositories/userRepository');
const { ApiError } = require('../middlewares/errorHandler');
const { getCurrentConfig } = require('../repositories/pointsConfigRepository');
const { query } = require('../db');

function buildFallbackAvatar(walletAddress) {
  const slug = String(walletAddress || '').toLowerCase() || 'user';
  return `https://api.dicebear.com/9.x/shapes/svg?seed=${encodeURIComponent(slug)}`;
}

async function createUserService({ wallet_address, email, name, avatar_url }) {
  const normalizedWallet = String(wallet_address || '').trim();
  if (!normalizedWallet) {
    throw new ApiError(400, 'wallet_address is required');
  }

  if (email) {
    const existingEmail = await findByEmail(email);
    if (existingEmail) {
      throw new ApiError(409, 'email already exists');
    }
  }

  const existingWallet = await findByWallet(normalizedWallet);
  if (existingWallet) {
    throw new ApiError(409, 'wallet_address already exists');
  }

  const id = crypto.randomUUID();
  const pointsConfig = await getCurrentConfig({ query });
  const defaultAvatar = String(pointsConfig?.default_user_avatar_url || '').trim();
  const short = normalizedWallet.slice(2, 8) || 'user';
  const safeName = String(name || '').trim() || `User-${short}`;
  const safeAvatar = String(avatar_url || '').trim() || defaultAvatar || buildFallbackAvatar(normalizedWallet);

  const created = await createUser({
    id,
    wallet_address: normalizedWallet,
    email: email || null,
    name: safeName,
    avatar_url: safeAvatar,
    role: 'user',
  });

  await upsertWalletForUser({ userId: created.id, address: normalizedWallet });
  return created;
}

async function updateUserProfileService(userId, { name, email, avatar_url }) {
  const existingUser = await findById(userId);
  if (!existingUser) {
    throw new ApiError(404, 'user not found');
  }

  const normalizedEmail = email || null;
  if (normalizedEmail) {
    const existingEmail = await findByEmail(normalizedEmail);
    if (existingEmail && existingEmail.id !== userId) {
      throw new ApiError(409, 'email already exists');
    }
  }

  const pointsConfig = await getCurrentConfig({ query });
  const requireProfileCompletion = Boolean(pointsConfig?.require_profile_completion ?? false);
  const nextName = String(name || '').trim() || String(existingUser.name || '').trim() || `User-${String(existingUser.wallet_address || '').slice(2, 8) || 'user'}`;
  const configuredAvatar = String(pointsConfig?.default_user_avatar_url || '').trim();
  const nextAvatar = String(avatar_url || '').trim()
    || String(existingUser.avatar_url || '').trim()
    || configuredAvatar
    || buildFallbackAvatar(existingUser.wallet_address);

  if (requireProfileCompletion && (!nextName || !nextAvatar)) {
    throw new ApiError(400, 'name and avatar_url are required');
  }

  return updateById(userId, {
    name: nextName,
    email: normalizedEmail,
    avatar_url: nextAvatar,
  });
}

module.exports = {
  userService: {
    createUser: createUserService,
    listUsers,
    findById,
    updateUserProfile: updateUserProfileService,
  },
};
