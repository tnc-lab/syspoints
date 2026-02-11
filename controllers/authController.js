const { authService } = require('../services/authService');
const { ApiError } = require('../middlewares/errorHandler');
const { isNonEmptyString } = require('../utils/validation');

async function issueNonce(req, res, next) {
  try {
    const { wallet_address } = req.body || {};

    if (!isNonEmptyString(wallet_address)) {
      throw new ApiError(400, 'wallet_address is invalid');
    }

    const result = await authService.issueNonce({ wallet_address });
    if (!result) {
      // Return generic response to avoid user enumeration.
      return res.status(200).json({
        user_id: null,
        wallet_address,
        nonce: 'invalid',
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      });
    }

    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function issueToken(req, res, next) {
  try {
    const { wallet_address, signature } = req.body || {};

    if (!wallet_address || !signature) {
      throw new ApiError(400, 'wallet_address and signature are required');
    }

    if (!isNonEmptyString(wallet_address) || !isNonEmptyString(signature)) {
      throw new ApiError(400, 'wallet_address and signature must be non-empty');
    }

    const token = await authService.issueToken({ wallet_address, signature });
    if (!token) {
      throw new ApiError(401, 'invalid signature or nonce');
    }

    res.status(200).json(token);
  } catch (err) {
    next(err);
  }
}

module.exports = { issueNonce, issueToken };
