const express = require('express');
const { getLeaderboard, getLeaderboardUser } = require('../controllers/leaderboardController');

const leaderboardRouter = express.Router();

leaderboardRouter.get('/', getLeaderboard);
leaderboardRouter.get('/user/:userId', getLeaderboardUser);

module.exports = { leaderboardRouter };
