const express = require('express');
const { getPointsConfig, updatePointsConfig, uploadDefaultAvatar } = require('../controllers/pointsConfigController');
const { authenticate, authorizeAdmin } = require('../middlewares/auth');

const adminRouter = express.Router();

adminRouter.get('/points-config', authenticate, authorizeAdmin, getPointsConfig);
adminRouter.put('/points-config', authenticate, authorizeAdmin, updatePointsConfig);
adminRouter.post('/points-config/default-avatar', authenticate, authorizeAdmin, uploadDefaultAvatar);

module.exports = { adminRouter };
