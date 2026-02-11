async function listLeaderboard(dbClient, { limit, offset }) {
  const dataResult = await dbClient.query(
    `SELECT
      u.id AS user_id,
      u.name,
      u.avatar_url,
      COALESCE(SUM(r.points_awarded), 0)::int AS total_points
    FROM users u
    LEFT JOIN reviews r ON r.user_id = u.id
    GROUP BY u.id
    ORDER BY total_points DESC, u.created_at DESC
    LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  const countResult = await dbClient.query(
    'SELECT COUNT(*)::int AS total FROM users'
  );

  return { rows: dataResult.rows, total: countResult.rows[0]?.total || 0 };
}

module.exports = {
  listLeaderboard,
};
