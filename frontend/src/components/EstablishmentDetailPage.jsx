const formatShortId = (value) => {
  const text = String(value || "").trim()
  if (!text) return "Unknown user"
  if (text.length <= 12) return text
  return `${text.slice(0, 8)}...${text.slice(-4)}`
}

const resolveAverageStars = (establishment, reviews) => {
  const fromEstablishment = Number(establishment?.avg_stars)
  if (Number.isFinite(fromEstablishment) && fromEstablishment > 0) {
    return fromEstablishment.toFixed(1)
  }
  const list = Array.isArray(reviews) ? reviews : []
  if (list.length === 0) return "0.0"
  const total = list.reduce((sum, item) => sum + Number(item?.stars || 0), 0)
  return (total / list.length).toFixed(1)
}

export default function EstablishmentDetailPage({
  establishment,
  reviews,
  reviewsMeta,
  loadingReviews,
  onPageChange,
  onBack,
}) {
  const currentPage = Number(reviewsMeta?.page || 1)
  const pageSize = Number(reviewsMeta?.page_size || 10)
  const total = Number(reviewsMeta?.total || 0)
  const canGoPrev = currentPage > 1
  const canGoNext = currentPage * pageSize < total
  const averageStars = resolveAverageStars(establishment, reviews)
  const reviewCount = Number(establishment?.review_count || total || 0)
  const location = String(
    establishment?.address || establishment?.district || establishment?.state_region || establishment?.country || ""
  ).trim()
  const category = String(establishment?.category || "").trim()

  return (
    <div className="grid">
      <section className="panel leaderboard-full-panel">
        <div className="panel-header">
          <h3 className="panel-title">Establishment</h3>
          <button className="ghost-button" onClick={onBack}>← Back</button>
        </div>

        <article className="leaderboard-full-entry" style={{ marginBottom: "12px" }}>
          <div className="leaderboard-item-main">
            {(establishment?.image_url || "").trim() ? (
              <img
                src={(establishment.image_url || "").trim()}
                alt={establishment?.name || "Establishment"}
                className="leaderboard-user-avatar-lg"
              />
            ) : (
              <div className="leaderboard-fallback-avatar" style={{ width: "64px", height: "64px", fontSize: "1rem" }}>
                {(establishment?.name || "E")?.[0] || "E"}
              </div>
            )}
            <div className="leaderboard-full-user">
              <strong>{establishment?.name || "Establishment"}</strong>
              <span>{location || category || "No details"}</span>
            </div>
          </div>
          <div className="leaderboard-full-metrics">
            <div className="leaderboard-metric">
              <strong>{averageStars}</strong>
              <span>Avg Stars</span>
            </div>
            <div className="leaderboard-metric">
              <strong>{reviewCount}</strong>
              <span>Reviews</span>
            </div>
          </div>
        </article>

        <div className="leaderboard-full-meta">
          <span>Reviews list</span>
          <span>{total} total</span>
        </div>

        {loadingReviews ? (
          <p>Loading reviews...</p>
        ) : reviews.length === 0 ? (
          <p>No reviews for this establishment yet.</p>
        ) : (
          <div className="leaderboard-full-list">
            {reviews.map((review, index) => {
              const stars = Number(review.stars || 0)
              const createdAtLabel = review.created_at ? new Date(review.created_at).toLocaleString() : "N/A"
              const rank = (currentPage - 1) * pageSize + index + 1
              return (
                <article className="leaderboard-full-entry" key={review.id || `${review.user_id}-${rank}`}>
                  <div className="leaderboard-item-main">
                    <strong>#{rank}</strong>
                    <div className="leaderboard-fallback-avatar">
                      {formatShortId(review.user_id).slice(0, 1)}
                    </div>
                    <div className="leaderboard-full-user">
                      <strong className="review-title preview">{review.title || "Untitled review"}</strong>
                      <span>{formatShortId(review.user_id)} · {createdAtLabel}</span>
                      <span className="review-sub preview">{review.description || "No description"}</span>
                    </div>
                  </div>
                  <div className="leaderboard-full-metrics">
                    <div className="leaderboard-metric">
                      <strong>
                        {"★".repeat(stars)}
                        {"☆".repeat(5 - stars)}
                      </strong>
                      <span>{stars}/5</span>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}

        <div className="leaderboard-full-pagination">
          <button className="ghost-button" disabled={!canGoPrev || loadingReviews} onClick={() => onPageChange(currentPage - 1)}>
            ← Prev
          </button>
          <button className="ghost-button" disabled={!canGoNext || loadingReviews} onClick={() => onPageChange(currentPage + 1)}>
            Next →
          </button>
        </div>
      </section>
    </div>
  )
}
