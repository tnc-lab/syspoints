const express = require('express');
const { getSiweNonce, verifySiwe } = require('../controllers/authController');

const authRouter = express.Router();

authRouter.get('/siwe/nonce', getSiweNonce);
authRouter.post('/siwe/verify', verifySiwe);

// Backward-compatible aliases
authRouter.get('/nonce', getSiweNonce);
authRouter.post('/verify', verifySiwe);

module.exports = { authRouter };
