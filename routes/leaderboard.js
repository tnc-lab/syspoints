const express = require('express');
const { getLeaderboard } = require('../controllers/leaderboardController');

const leaderboardRouter = express.Router();

leaderboardRouter.get('/', getLeaderboard);

module.exports = { leaderboardRouter };
