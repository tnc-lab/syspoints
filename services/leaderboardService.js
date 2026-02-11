const { query } = require('../db');
const { listLeaderboard } = require('../repositories/leaderboardRepository');

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

module.exports = {
  leaderboardService: {
    getLeaderboard,
  },
};
