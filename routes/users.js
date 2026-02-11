const express = require('express');
const { createUser, listUsers } = require('../controllers/usersController');
const { authenticate, authorizeAdmin } = require('../middlewares/auth');

const usersRouter = express.Router();

usersRouter.post('/', createUser);
usersRouter.get('/', authenticate, authorizeAdmin, listUsers);

module.exports = { usersRouter };
