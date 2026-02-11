require('dotenv').config();

const { app } = require('./app');
const { requireEnv } = require('./config/env');

const PORT = requireEnv('PORT');
requireEnv('JWT_SECRET');

app.listen(PORT, () => {
  console.log(`Syspoints API listening on port ${PORT}`);
});
