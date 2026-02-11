const express = require('express');
const { createUser, listUsers, getMe, updateMe, uploadMyAvatar } = require('../controllers/usersController');
const { authenticate, authorizeAdmin } = require('../middlewares/auth');

const usersRouter = express.Router();

usersRouter.post('/', createUser);
usersRouter.get('/me', authenticate, getMe);
usersRouter.put('/me', authenticate, updateMe);
usersRouter.post('/me/avatar', authenticate, uploadMyAvatar);
usersRouter.get('/', authenticate, authorizeAdmin, listUsers);

module.exports = { usersRouter };
