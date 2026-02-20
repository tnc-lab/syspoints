const express = require('express');
const { getPointsConfig } = require('../controllers/pointsConfigController');

const configRouter = express.Router();

// Public read-only branding/config endpoint.
configRouter.get('/', getPointsConfig);
configRouter.get('/points-config', getPointsConfig);

module.exports = { configRouter };
