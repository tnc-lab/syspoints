const { Pool } = require('pg');
const { requireEnv } = require('./env');

function buildPoolConfig() {
  const databaseUrl = requireEnv('DATABASE_URL');
  const max = Number(process.env.PGPOOL_MAX || 1);
  return { connectionString: databaseUrl, max };
}

const pool = new Pool(buildPoolConfig());

pool.on('error', (err) => {
  console.error('Unexpected PG pool error', err);
});

module.exports = { pool };
