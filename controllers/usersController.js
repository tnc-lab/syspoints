const { userService } = require('../services/userService');
const { ApiError } = require('../middlewares/errorHandler');
const { isNonEmptyString, isValidEmail, isValidUrl } = require('../utils/validation');

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

module.exports = { createUser, listUsers };
