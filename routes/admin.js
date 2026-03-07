const express = require('express');
const { getPointsConfig, updatePointsConfig, uploadDefaultAvatar, uploadWalletLogo } = require('../controllers/pointsConfigController');
const { listModules, uploadModule, activateModule, deactivateModule } = require('../controllers/systemModuleController');
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
adminRouter.get('/modules', authenticate, authorizeAdmin, listModules);
adminRouter.post('/modules', authenticate, authorizeAdmin, uploadModule);
adminRouter.post('/modules/:moduleKey/activate', authenticate, authorizeAdmin, activateModule);
adminRouter.post('/modules/:moduleKey/deactivate', authenticate, authorizeAdmin, deactivateModule);

module.exports = { adminRouter };
