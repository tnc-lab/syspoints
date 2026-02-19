const crypto = require('crypto');
const { Wallet } = require('ethers');
const { findByEmail, findByWallet, createUser, listUsers, findById, updateById, upsertWalletForUser } = require('../repositories/userRepository');
const { ApiError } = require('../middlewares/errorHandler');

async function createUserService({ wallet_address, email, name, avatar_url }) {
  if (email) {
    const existingEmail = await findByEmail(email);
    if (existingEmail) {
      throw new ApiError(409, 'email already exists');
    }
  }

  let walletAddress = wallet_address;
  if (walletAddress) {
    const existingWallet = await findByWallet(walletAddress);
    if (existingWallet) {
      throw new ApiError(409, 'wallet_address already exists');
    }
  }

  if (!walletAddress) {
    const wallet = Wallet.createRandom();
    walletAddress = wallet.address;
  }

  const id = crypto.randomUUID();

  const created = await createUser({
    id,
    wallet_address: walletAddress,
    email: email || null,
    name,
    avatar_url,
    role: 'user',
  });

  await upsertWalletForUser({ userId: created.id, address: walletAddress });
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

  return updateById(userId, {
    name,
    email: normalizedEmail,
    avatar_url,
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
