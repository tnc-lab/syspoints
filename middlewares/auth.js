const jwt = require('jsonwebtoken');
const { requireEnv } = require('../config/env');
const { ApiError } = require('./errorHandler');

function authenticate(req, res, next) {
  const authHeader = req.header('Authorization') || '';
  const [, token] = authHeader.split(' ');

  if (!token) {
    return next(new ApiError(401, 'missing bearer token'));
  }

  try {
    const secret = requireEnv('JWT_SECRET');
    const payload = jwt.verify(token, secret);
    req.auth = payload;
    return next();
  } catch (err) {
    return next(new ApiError(401, 'invalid token'));
  }
}

function authorizeAdmin(req, res, next) {
  if (!req.auth || req.auth.role !== 'admin') {
    return next(new ApiError(403, 'admin access required'));
  }
  return next();
}

module.exports = {
  authenticate,
  authorizeAdmin,
};
