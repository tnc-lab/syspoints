const express = require('express');
const {
  listEstablishments,
  listTopReviewedEstablishments,
  createEstablishment,
  updateEstablishment,
  resolveEstablishmentFromLocation,
  searchLocation,
  suggestEstablishmentImages,
  uploadEstablishmentImage,
} = require('../controllers/establishmentsController');
const { authenticate, authorizeAdmin } = require('../middlewares/auth');

const establishmentsRouter = express.Router();

establishmentsRouter.get('/', listEstablishments);
establishmentsRouter.get('/top-reviewed', listTopReviewedEstablishments);
establishmentsRouter.post('/search-location', searchLocation);
establishmentsRouter.post('/resolve', resolveEstablishmentFromLocation);
establishmentsRouter.post('/suggest-images', suggestEstablishmentImages);
establishmentsRouter.post('/upload-image', uploadEstablishmentImage);
establishmentsRouter.post('/', authenticate, authorizeAdmin, createEstablishment);
establishmentsRouter.put('/:id', authenticate, authorizeAdmin, updateEstablishment);

module.exports = { establishmentsRouter };
