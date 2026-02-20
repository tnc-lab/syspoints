const express = require('express');
const { getPointsConfig, updatePointsConfig, uploadDefaultAvatar, uploadWalletLogo } = require('../controllers/pointsConfigController');
const { authenticate, authorizeAdmin } = require('../middlewares/auth');

const adminRouter = express.Router();

adminRouter.get('/points-config', authenticate, authorizeAdmin, getPointsConfig);
adminRouter.put('/points-config', authenticate, authorizeAdmin, updatePointsConfig);
adminRouter.post('/points-config/default-avatar', authenticate, authorizeAdmin, uploadDefaultAvatar);
adminRouter.post('/points-config/wallet-logo', authenticate, authorizeAdmin, uploadWalletLogo);
adminRouter.get('/config', authenticate, authorizeAdmin, getPointsConfig);
adminRouter.put('/config', authenticate, authorizeAdmin, updatePointsConfig);
adminRouter.post('/config/default-avatar', authenticate, authorizeAdmin, uploadDefaultAvatar);
adminRouter.post('/config/wallet-logo', authenticate, authorizeAdmin, uploadWalletLogo);

module.exports = { adminRouter };
