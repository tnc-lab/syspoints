const express = require('express');
const { createUser } = require('../controllers/usersController');

const usersRouter = express.Router();

usersRouter.post('/', createUser);

module.exports = { usersRouter };
