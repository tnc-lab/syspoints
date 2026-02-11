const express = require('express');
const { createReview, getReviewById, listReviews } = require('../controllers/reviewsController');
const { authenticate } = require('../middlewares/auth');

const reviewsRouter = express.Router();

reviewsRouter.post('/', authenticate, createReview);
reviewsRouter.get('/', listReviews);
reviewsRouter.get('/:id', getReviewById);

module.exports = { reviewsRouter };
