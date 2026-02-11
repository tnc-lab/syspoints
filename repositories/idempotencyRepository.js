async function findByUserAndKey(dbClient, userId, key) {
  const result = await dbClient.query(
    `SELECT response_body
     FROM idempotency_keys
     WHERE user_id = $1 AND idempotency_key = $2`,
    [userId, key]
  );
  return result.rows[0]?.response_body || null;
}

async function saveResponse(dbClient, userId, key, responseBody) {
  await dbClient.query(
    `INSERT INTO idempotency_keys (user_id, idempotency_key, response_body)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, idempotency_key) DO NOTHING`,
    [userId, key, responseBody]
  );
}

module.exports = {
  findByUserAndKey,
  saveResponse,
};
