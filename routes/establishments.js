const express = require('express');
const { listEstablishments, createEstablishment, updateEstablishment, uploadEstablishmentImage } = require('../controllers/establishmentsController');
const { authenticate, authorizeAdmin } = require('../middlewares/auth');

const establishmentsRouter = express.Router();

establishmentsRouter.get('/', listEstablishments);
establishmentsRouter.post('/upload-image', authenticate, authorizeAdmin, uploadEstablishmentImage);
establishmentsRouter.post('/', authenticate, authorizeAdmin, createEstablishment);
establishmentsRouter.put('/:id', authenticate, authorizeAdmin, updateEstablishment);

module.exports = { establishmentsRouter };
