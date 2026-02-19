const { authService } = require('../services/authService');
const { ApiError } = require('../middlewares/errorHandler');
const { isNonEmptyString } = require('../utils/validation');

function resolveRequestDomain(req) {
  const origin = req.header('origin') || '';
  const host = req.header('x-forwarded-host') || req.header('host') || '';
  return origin || host;
}

async function getSiweNonce(req, res, next) {
  try {
    const walletAddress = String(req.query?.address || '').trim();
    if (!isNonEmptyString(walletAddress)) {
      throw new ApiError(400, 'address query param is required');
    }

    const domainSource = resolveRequestDomain(req);
    const domain = String(req.query?.domain || domainSource).trim();
    const uri = String(req.query?.uri || req.header('origin') || '').trim();
    const chainId = Number(req.query?.chain_id || 0);

    const result = await authService.issueSiweNonce({
      walletAddress,
      domain,
      uri,
      chainId,
    });
    if (!result) {
      throw new ApiError(400, 'invalid wallet address');
    }

    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function verifySiwe(req, res, next) {
  try {
    const { message, signature } = req.body || {};
    if (!isNonEmptyString(message) || !isNonEmptyString(signature)) {
      throw new ApiError(400, 'message and signature are required');
    }

    const result = await authService.verifySiwe({
      message,
      signature,
      requestDomain: resolveRequestDomain(req),
    });

    if (!result) {
      throw new ApiError(401, 'invalid SIWE message or signature');
    }

    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getSiweNonce,
  verifySiwe,
};
