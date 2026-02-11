const crypto = require('crypto');
const { Wallet } = require('ethers');
const { findByEmail, findByWallet, createUser, listUsers } = require('../repositories/userRepository');
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

  return createUser({
    id,
    wallet_address: walletAddress,
    email: email || null,
    name,
    avatar_url,
    role: 'user',
  });
}

module.exports = {
  userService: {
    createUser: createUserService,
    listUsers,
  },
};
