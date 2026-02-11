const express = require('express');
const { getPointsConfig, updatePointsConfig } = require('../controllers/pointsConfigController');
const { authenticate, authorizeAdmin } = require('../middlewares/auth');

const adminRouter = express.Router();

adminRouter.get('/points-config', authenticate, authorizeAdmin, getPointsConfig);
adminRouter.put('/points-config', authenticate, authorizeAdmin, updatePointsConfig);

module.exports = { adminRouter };
