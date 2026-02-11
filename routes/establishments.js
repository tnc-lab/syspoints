const express = require('express');
const { listEstablishments, createEstablishment } = require('../controllers/establishmentsController');
const { authenticate, authorizeAdmin } = require('../middlewares/auth');

const establishmentsRouter = express.Router();

establishmentsRouter.get('/', listEstablishments);
establishmentsRouter.post('/', authenticate, authorizeAdmin, createEstablishment);

module.exports = { establishmentsRouter };
