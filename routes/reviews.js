const express = require('express');
const { createReview, getReviewById } = require('../controllers/reviewsController');

const reviewsRouter = express.Router();

reviewsRouter.post('/', createReview);
reviewsRouter.get('/:id', getReviewById);

module.exports = { reviewsRouter };
