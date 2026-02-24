import { resolveDisplayLabel } from "./leaderboardUtils"

export default function LeaderboardUserPage({
  user,
  loadingReviews,
  reviews,
  reviewsMeta,
  onPageChange,
  onBack,
  formatShortWalletAddress,
  getDefaultAvatarUrl,
  establishmentsById,
}) {
  const shortWallet = formatShortWalletAddress(user?.wallet_address)
  const displayLabel = resolveDisplayLabel(user, shortWallet)
  const page = Number(reviewsMeta?.page || 1)
  const pageSize = Number(reviewsMeta?.page_size || 10)
  const total = Number(reviewsMeta?.total || 0)
  const canGoPrev = page > 1
  const canGoNext = page * pageSize < total

  return (
    <div className="grid">
      <section className="panel leaderboard-full-panel">
        <div className="panel-header">
          <h3 className="panel-title">User Profile</h3>
          <button className="ghost-button" onClick={onBack}>← Back to ranking</button>
        </div>

        <div className="leaderboard-user-header">
          <img
            src={(user?.avatar_url || "").trim() || getDefaultAvatarUrl(user?.user_id || user?.wallet_address || "user")}
            alt={displayLabel || "User"}
            className="leaderboard-user-avatar-lg"
          />
          <div className="leaderboard-user-header-main">
            <h4>{displayLabel || "Anon"}</h4>
            <p>{shortWallet || "No wallet"}</p>
          </div>
          <div className="leaderboard-full-metrics">
            <div className="leaderboard-metric">
              <strong>{Number(user?.total_points || 0)}</strong>
              <span>Points</span>
            </div>
            <div className="leaderboard-metric">
              <strong>{Number(user?.review_count || 0)}</strong>
              <span>Reviews</span>
            </div>
          </div>
        </div>

        <div className="panel-header" style={{ marginTop: "14px" }}>
          <h3 className="panel-title">Reviews by user</h3>
          <span className="pill">{total} total</span>
        </div>

        {loadingReviews ? (
          <p>Loading user reviews...</p>
        ) : reviews.length === 0 ? (
          <p>This user has not published reviews yet.</p>
        ) : (
          <div className="leaderboard-full-list">
            {reviews.map((review, index) => {
              const globalPosition = (page - 1) * pageSize + index + 1
              return (
                <article key={review.id || globalPosition} className="leaderboard-full-entry">
                  <div className="leaderboard-item-main">
                    <strong>#{globalPosition}</strong>
                    <div className="leaderboard-fallback-avatar">
                      {(establishmentsById.get(review.establishment_id)?.name || "E")?.[0] || "E"}
                    </div>
                    <div className="leaderboard-full-user">
                      <strong>{review.title || "Untitled review"}</strong>
                      <span>{establishmentsById.get(review.establishment_id)?.name || review.establishment_id}</span>
                    </div>
                  </div>
                  <div className="leaderboard-full-metrics">
                    <div className="leaderboard-metric">
                      <strong>{Number(review.points_awarded || 0)}</strong>
                      <span>Points</span>
                    </div>
                    <div className="leaderboard-metric">
                      <strong>{Number(review.stars || 0)}★</strong>
                      <span>Stars</span>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}

        <div className="leaderboard-full-pagination">
          <button className="ghost-button" disabled={!canGoPrev || loadingReviews} onClick={() => onPageChange(page - 1)}>
            ← Prev
          </button>
          <button className="ghost-button" disabled={!canGoNext || loadingReviews} onClick={() => onPageChange(page + 1)}>
            Next →
          </button>
        </div>
      </section>
    </div>
  )
}
