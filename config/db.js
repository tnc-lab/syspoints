const { Pool } = require('pg');
const { requireEnv } = require('./env');

function buildPoolConfig() {
  const databaseUrl = requireEnv('DATABASE_URL');
  return { connectionString: databaseUrl };
}

const pool = new Pool(buildPoolConfig());

pool.on('error', (err) => {
  console.error('Unexpected PG pool error', err);
});

module.exports = { pool };
