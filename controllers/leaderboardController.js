const { leaderboardService } = require('../services/leaderboardService');
const { ApiError } = require('../middlewares/errorHandler');

async function getLeaderboard(req, res, next) {
  try {
    const page = Number(req.query.page || 1);
    const pageSize = Number(req.query.page_size || 20);

    if (!Number.isInteger(page) || page < 1) {
      throw new ApiError(400, 'page must be a positive integer');
    }

    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
      throw new ApiError(400, 'page_size must be an integer between 1 and 100');
    }

    const result = await leaderboardService.getLeaderboard({ page, pageSize });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function getLeaderboardUser(req, res, next) {
  try {
    const userId = String(req.params?.userId || '').trim();
    if (!userId) {
      throw new ApiError(400, 'userId is required');
    }

    const user = await leaderboardService.getLeaderboardUserById({ userId });
    if (!user) {
      throw new ApiError(404, 'user not found');
    }

    res.status(200).json(user);
  } catch (err) {
    next(err);
  }
}

module.exports = { getLeaderboard, getLeaderboardUser };
