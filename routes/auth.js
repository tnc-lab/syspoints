const express = require('express');
const { issueToken, issueNonce } = require('../controllers/authController');

const authRouter = express.Router();

authRouter.post('/nonce', issueNonce);
authRouter.post('/token', issueToken);

module.exports = { authRouter };
