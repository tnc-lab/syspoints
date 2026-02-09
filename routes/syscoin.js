const express = require('express');
const { submitReviewHash } = require('../controllers/syscoinController');

const syscoinRouter = express.Router();

syscoinRouter.post('/review-hash', submitReviewHash);

module.exports = { syscoinRouter };
