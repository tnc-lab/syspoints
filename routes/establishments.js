const express = require('express');
const { listEstablishments, createEstablishment } = require('../controllers/establishmentsController');

const establishmentsRouter = express.Router();

establishmentsRouter.get('/', listEstablishments);
establishmentsRouter.post('/', createEstablishment);

module.exports = { establishmentsRouter };
