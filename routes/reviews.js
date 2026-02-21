const express = require('express');
const {
  createReview,
  createReviewSubmission,
  getReviewById,
  listReviews,
  uploadReviewEvidenceImage,
  saveReviewAnchorTx,
  getReviewCaptchaChallenge,
  getDailyReviewLimitStatus,
  listMyReviewStatuses,
  listPendingReviewSubmissions,
  approveReviewSubmission,
  rejectReviewSubmission,
} = require('../controllers/reviewsController');
const { authenticate, authorizeAdmin } = require('../middlewares/auth');

const reviewsRouter = express.Router();

reviewsRouter.post('/', authenticate, createReview);
reviewsRouter.post('/submissions', authenticate, createReviewSubmission);
reviewsRouter.post('/upload-evidence', authenticate, uploadReviewEvidenceImage);
reviewsRouter.post('/:id/anchor-tx', authenticate, saveReviewAnchorTx);
reviewsRouter.get('/captcha-challenge', authenticate, getReviewCaptchaChallenge);
reviewsRouter.get('/daily-limit-status', authenticate, getDailyReviewLimitStatus);
reviewsRouter.get('/my-statuses', authenticate, listMyReviewStatuses);
reviewsRouter.get('/submissions/pending', authenticate, authorizeAdmin, listPendingReviewSubmissions);
reviewsRouter.post('/submissions/:id/approve', authenticate, authorizeAdmin, approveReviewSubmission);
reviewsRouter.post('/submissions/:id/reject', authenticate, authorizeAdmin, rejectReviewSubmission);
reviewsRouter.get('/', listReviews);
reviewsRouter.get('/:id', getReviewById);

module.exports = { reviewsRouter };
