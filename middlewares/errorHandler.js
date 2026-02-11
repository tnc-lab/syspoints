class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function mapDatabaseError(err) {
  if (!err || !err.code) return null;

  if (err.code === '23505') {
    return { status: 409, message: 'conflict' };
  }

  if (err.code === '23502' || err.code === '23514') {
    return { status: 400, message: 'invalid input' };
  }

  return null;
}

function errorHandler(err, req, res, next) {
  const mapped = mapDatabaseError(err);
  const status = mapped?.status || err.status || 500;
  const message = mapped?.message || err.message || 'Internal Server Error';

  if (status >= 500) {
    console.error(err);
  }

  res.status(status).json({
    error: {
      message,
    },
  });
}

module.exports = {
  ApiError,
  errorHandler,
};
