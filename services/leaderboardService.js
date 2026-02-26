const { query } = require('../db');
const { listLeaderboard, findLeaderboardUserById } = require('../repositories/leaderboardRepository');

async function getLeaderboard({ page, pageSize }) {
  const offset = (page - 1) * pageSize;
  const { rows, total } = await listLeaderboard({ query }, { limit: pageSize, offset });

  return {
    data: rows,
    meta: {
      page,
      page_size: pageSize,
      total,
    },
  };
}

async function getLeaderboardUserById({ userId }) {
  return findLeaderboardUserById({ query }, userId);
}

module.exports = {
  leaderboardService: {
    getLeaderboard,
    getLeaderboardUserById,
  },
};
