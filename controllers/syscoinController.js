const { syscoinService } = require('../services/syscoinService');
const { ApiError } = require('../middlewares/errorHandler');
const { isValidUuid } = require('../utils/validation');

async function submitReviewHash(req, res, next) {
  try {
    const { review_id } = req.body || {};

    if (!isValidUuid(review_id)) {
      throw new ApiError(400, 'review_id must be a UUID');
    }

    const result = await syscoinService.submitReviewHashByReviewId(review_id);
    if (!result) {
      throw new ApiError(404, 'review not found');
    }

    res.status(202).json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { submitReviewHash };
