const { establishmentService } = require('../services/establishmentService');
const { ApiError } = require('../middlewares/errorHandler');
const { isNonEmptyString } = require('../utils/validation');

async function listEstablishments(req, res, next) {
  try {
    const establishments = await establishmentService.listEstablishments();
    res.status(200).json(establishments);
  } catch (err) {
    next(err);
  }
}

async function createEstablishment(req, res, next) {
  try {
    const { name, category } = req.body || {};

    if (!isNonEmptyString(name)) {
      throw new ApiError(400, 'name is required');
    }

    if (!isNonEmptyString(category)) {
      throw new ApiError(400, 'category is required');
    }

    const establishment = await establishmentService.createEstablishment({ name, category });
    res.status(201).json(establishment);
  } catch (err) {
    next(err);
  }
}

module.exports = { listEstablishments, createEstablishment };
