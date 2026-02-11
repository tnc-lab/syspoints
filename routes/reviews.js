const express = require('express');
const { createReview, getReviewById, listReviews, uploadReviewEvidenceImage } = require('../controllers/reviewsController');
const { authenticate } = require('../middlewares/auth');

const reviewsRouter = express.Router();

reviewsRouter.post('/', authenticate, createReview);
reviewsRouter.post('/upload-evidence', authenticate, uploadReviewEvidenceImage);
reviewsRouter.get('/', listReviews);
reviewsRouter.get('/:id', getReviewById);

module.exports = { reviewsRouter };
