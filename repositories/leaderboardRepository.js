async function listLeaderboard(dbClient, { limit, offset }) {
  let dataResult;
  try {
    dataResult = await dbClient.query(
      `SELECT
      u.id AS user_id,
      u.name,
      u.wallet_address,
      u.leaderboard_display_mode,
      COALESCE(
        NULLIF(BTRIM(u.avatar_url), ''), pc.default_user_avatar_url
      ) AS avatar_url,
      (COALESCE(rstats.total_review_points, 0) + COALESCE(sstats.total_share_points, 0))::int AS total_points,
      COALESCE(rstats.review_count, 0)::int AS review_count
    FROM users u
    LEFT JOIN LATERAL (
      SELECT default_user_avatar_url
      FROM points_config
      WHERE NULLIF(BTRIM(default_user_avatar_url), '') IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 1
    ) pc ON TRUE
    LEFT JOIN LATERAL (
      SELECT
        COALESCE(SUM(r.points_awarded), 0)::int AS total_review_points,
        COALESCE(COUNT(r.id), 0)::int AS review_count
      FROM reviews r
      WHERE r.user_id = u.id
    ) rstats ON TRUE
    LEFT JOIN LATERAL (
      SELECT
        COALESCE(SUM(rs.share_points_awarded), 0)::int AS total_share_points
      FROM review_shares rs
      WHERE rs.shared_by_user_id = u.id
    ) sstats ON TRUE
    GROUP BY u.id, pc.default_user_avatar_url, rstats.total_review_points, rstats.review_count, sstats.total_share_points
    ORDER BY total_points DESC, u.created_at DESC
    LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
  } catch (err) {
    if (err?.code !== '42P01') {
      throw err;
    }
    // Fallback for environments where review_shares migration is not applied yet.
    dataResult = await dbClient.query(
      `SELECT
        u.id AS user_id,
        u.name,
        u.wallet_address,
        u.leaderboard_display_mode,
        COALESCE(
          NULLIF(BTRIM(u.avatar_url), ''), pc.default_user_avatar_url
        ) AS avatar_url,
        COALESCE(rstats.total_review_points, 0)::int AS total_points,
        COALESCE(rstats.review_count, 0)::int AS review_count
      FROM users u
      LEFT JOIN LATERAL (
        SELECT default_user_avatar_url
        FROM points_config
        WHERE NULLIF(BTRIM(default_user_avatar_url), '') IS NOT NULL
        ORDER BY created_at DESC
        LIMIT 1
      ) pc ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          COALESCE(SUM(r.points_awarded), 0)::int AS total_review_points,
          COALESCE(COUNT(r.id), 0)::int AS review_count
        FROM reviews r
        WHERE r.user_id = u.id
      ) rstats ON TRUE
      GROUP BY u.id, pc.default_user_avatar_url, rstats.total_review_points, rstats.review_count
      ORDER BY total_points DESC, u.created_at DESC
      LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
  }

  const countResult = await dbClient.query(
    'SELECT COUNT(*)::int AS total FROM users'
  );

  return { rows: dataResult.rows, total: countResult.rows[0]?.total || 0 };
}

async function findLeaderboardUserById(dbClient, userId) {
  let result;
  try {
    result = await dbClient.query(
      `SELECT
      u.id AS user_id,
      u.name,
      u.wallet_address,
      u.leaderboard_display_mode,
      COALESCE(
        NULLIF(BTRIM(u.avatar_url), ''), pc.default_user_avatar_url
      ) AS avatar_url,
      (COALESCE(rstats.total_review_points, 0) + COALESCE(sstats.total_share_points, 0))::int AS total_points,
      COALESCE(rstats.review_count, 0)::int AS review_count
    FROM users u
    LEFT JOIN LATERAL (
      SELECT default_user_avatar_url
      FROM points_config
      WHERE NULLIF(BTRIM(default_user_avatar_url), '') IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 1
    ) pc ON TRUE
    LEFT JOIN LATERAL (
      SELECT
        COALESCE(SUM(r.points_awarded), 0)::int AS total_review_points,
        COALESCE(COUNT(r.id), 0)::int AS review_count
      FROM reviews r
      WHERE r.user_id = u.id
    ) rstats ON TRUE
    LEFT JOIN LATERAL (
      SELECT
        COALESCE(SUM(rs.share_points_awarded), 0)::int AS total_share_points
      FROM review_shares rs
      WHERE rs.shared_by_user_id = u.id
    ) sstats ON TRUE
    WHERE u.id = $1
    GROUP BY u.id, pc.default_user_avatar_url, rstats.total_review_points, rstats.review_count, sstats.total_share_points
    LIMIT 1`,
      [userId]
    );
  } catch (err) {
    if (err?.code !== '42P01') {
      throw err;
    }
    result = await dbClient.query(
      `SELECT
        u.id AS user_id,
        u.name,
        u.wallet_address,
        u.leaderboard_display_mode,
        COALESCE(
          NULLIF(BTRIM(u.avatar_url), ''), pc.default_user_avatar_url
        ) AS avatar_url,
        COALESCE(rstats.total_review_points, 0)::int AS total_points,
        COALESCE(rstats.review_count, 0)::int AS review_count
      FROM users u
      LEFT JOIN LATERAL (
        SELECT default_user_avatar_url
        FROM points_config
        WHERE NULLIF(BTRIM(default_user_avatar_url), '') IS NOT NULL
        ORDER BY created_at DESC
        LIMIT 1
      ) pc ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          COALESCE(SUM(r.points_awarded), 0)::int AS total_review_points,
          COALESCE(COUNT(r.id), 0)::int AS review_count
        FROM reviews r
        WHERE r.user_id = u.id
      ) rstats ON TRUE
      WHERE u.id = $1
      GROUP BY u.id, pc.default_user_avatar_url, rstats.total_review_points, rstats.review_count
      LIMIT 1`,
      [userId]
    );
  }

  return result.rows[0] || null;
}

module.exports = {
  listLeaderboard,
  findLeaderboardUserById,
};
