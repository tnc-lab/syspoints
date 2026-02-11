const express = require('express');
const { submitReviewHash } = require('../controllers/syscoinController');
const { authenticate } = require('../middlewares/auth');

const syscoinRouter = express.Router();

syscoinRouter.post('/review-hash', authenticate, submitReviewHash);

module.exports = { syscoinRouter };
