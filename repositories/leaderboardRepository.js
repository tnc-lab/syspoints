async function listLeaderboard(dbClient, { limit, offset }) {
  const dataResult = await dbClient.query(
    `SELECT
      u.id AS user_id,
      u.name,
      u.wallet_address,
      u.leaderboard_display_mode,
      COALESCE(
        NULLIF(BTRIM(u.avatar_url), ''),
        pc.default_user_avatar_url
      ) AS avatar_url,
      COALESCE(SUM(r.points_awarded), 0)::int AS total_points,
      COALESCE(COUNT(r.id), 0)::int AS review_count
    FROM users u
    LEFT JOIN LATERAL (
      SELECT default_user_avatar_url
      FROM points_config
      WHERE NULLIF(BTRIM(default_user_avatar_url), '') IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 1
    ) pc ON TRUE
    LEFT JOIN reviews r ON r.user_id = u.id
    GROUP BY u.id, pc.default_user_avatar_url
    ORDER BY total_points DESC, u.created_at DESC
    LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  const countResult = await dbClient.query(
    'SELECT COUNT(*)::int AS total FROM users'
  );

  return { rows: dataResult.rows, total: countResult.rows[0]?.total || 0 };
}

async function findLeaderboardUserById(dbClient, userId) {
  const result = await dbClient.query(
    `SELECT
      u.id AS user_id,
      u.name,
      u.wallet_address,
      u.leaderboard_display_mode,
      COALESCE(
        NULLIF(BTRIM(u.avatar_url), ''),
        pc.default_user_avatar_url
      ) AS avatar_url,
      COALESCE(SUM(r.points_awarded), 0)::int AS total_points,
      COALESCE(COUNT(r.id), 0)::int AS review_count
    FROM users u
    LEFT JOIN LATERAL (
      SELECT default_user_avatar_url
      FROM points_config
      WHERE NULLIF(BTRIM(default_user_avatar_url), '') IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 1
    ) pc ON TRUE
    LEFT JOIN reviews r ON r.user_id = u.id
    WHERE u.id = $1
    GROUP BY u.id, pc.default_user_avatar_url
    LIMIT 1`,
    [userId]
  );

  return result.rows[0] || null;
}

module.exports = {
  listLeaderboard,
  findLeaderboardUserById,
};
