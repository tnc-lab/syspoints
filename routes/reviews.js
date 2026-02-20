const express = require('express');
const {
  createReview,
  getReviewById,
  listReviews,
  uploadReviewEvidenceImage,
  saveReviewAnchorTx,
  getReviewCaptchaChallenge,
  getDailyReviewLimitStatus,
} = require('../controllers/reviewsController');
const { authenticate } = require('../middlewares/auth');

const reviewsRouter = express.Router();

reviewsRouter.post('/', authenticate, createReview);
reviewsRouter.post('/upload-evidence', authenticate, uploadReviewEvidenceImage);
reviewsRouter.post('/:id/anchor-tx', authenticate, saveReviewAnchorTx);
reviewsRouter.get('/captcha-challenge', authenticate, getReviewCaptchaChallenge);
reviewsRouter.get('/daily-limit-status', authenticate, getDailyReviewLimitStatus);
reviewsRouter.get('/', listReviews);
reviewsRouter.get('/:id', getReviewById);

module.exports = { reviewsRouter };
