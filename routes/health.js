const express = require('express');
const { query } = require('../db');

const healthRouter = express.Router();

healthRouter.get('/', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

healthRouter.get('/db', async (req, res) => {
  try {
    await query('SELECT 1');
    res.status(200).json({ status: 'ok', db: 'up' });
  } catch (err) {
    res.status(500).json({ status: 'error', db: 'down' });
  }
});

module.exports = { healthRouter };
