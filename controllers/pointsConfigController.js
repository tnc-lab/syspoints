const { pointsConfigService } = require('../services/pointsConfigService');
const { ApiError } = require('../middlewares/errorHandler');

const FIELDS = [
  'image_points_yes',
  'image_points_no',
  'description_points_gt_200',
  'description_points_lte_200',
  'stars_points_yes',
  'stars_points_no',
  'price_points_lt_100',
  'price_points_gte_100',
];

function validatePayload(payload) {
  for (const field of FIELDS) {
    if (!Number.isInteger(payload[field])) {
      return `${field} must be an integer`;
    }
  }
  return null;
}

async function getPointsConfig(req, res, next) {
  try {
    const config = await pointsConfigService.getPointsConfig();
    res.status(200).json(config || {});
  } catch (err) {
    next(err);
  }
}

async function updatePointsConfig(req, res, next) {
  try {
    const payload = req.body || {};
    const error = validatePayload(payload);
    if (error) {
      throw new ApiError(400, error);
    }

    const updated = await pointsConfigService.setPointsConfig(payload);
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getPointsConfig,
  updatePointsConfig,
};
