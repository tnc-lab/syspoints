export default function FullTopEstablishmentsPage({
  loading,
  entries,
  meta,
  onPageChange,
  onSelectEstablishment,
}) {
  const currentPage = Number(meta?.page || 1)
  const pageSize = Number(meta?.page_size || 20)
  const total = Number(meta?.total || 0)
  const canGoPrev = currentPage > 1
  const canGoNext = currentPage * pageSize < total
  const firstPosition = total > 0 ? (currentPage - 1) * pageSize + 1 : 0
  const lastPosition = total > 0 ? Math.min(currentPage * pageSize, total) : 0

  return (
    <div className="grid">
      <section className="panel leaderboard-full-panel">
        <div className="panel-header">
          <h3 className="panel-title">Top Establishments</h3>
          <span className="pill">{total} establishments</span>
        </div>

        <div className="leaderboard-full-meta">
          <span>Showing {firstPosition}-{lastPosition}</span>
          <span>Page {currentPage}</span>
        </div>

        {loading ? (
          <p>Loading establishments...</p>
        ) : entries.length === 0 ? (
          <p>No establishments with reviews available yet.</p>
        ) : (
          <div className="leaderboard-full-list">
            {entries.map((entry, index) => {
              const globalRank = (currentPage - 1) * pageSize + index + 1
              const avgStars = Number(entry.avg_stars || 0).toFixed(1)
              const reviewCount = Number(entry.review_count || 0)
              const category = String(entry.category || "").trim()
              const location = String(entry.address || entry.district || entry.state_region || entry.country || "").trim()
              return (
                <article className="leaderboard-full-entry" key={entry.id || globalRank}>
                  <button className="leaderboard-user-button" onClick={() => onSelectEstablishment?.(entry)} title="View establishment">
                    <div className="leaderboard-item-main">
                      <strong>#{globalRank}</strong>
                      {(entry.image_url || "").trim() ? (
                        <img
                          src={(entry.image_url || "").trim()}
                          alt={entry.name || "Establishment"}
                          className="leaderboard-avatar"
                        />
                      ) : (
                        <div className="leaderboard-fallback-avatar">
                          {(entry.name || "E")?.[0] || "E"}
                        </div>
                      )}
                      <div className="leaderboard-full-user">
                        <strong>{entry.name || "Establishment"}</strong>
                        <span>{location || category || "No details"}</span>
                      </div>
                    </div>
                  </button>
                  <div className="leaderboard-full-metrics">
                    <div className="leaderboard-metric">
                      <strong>{avgStars}</strong>
                      <span>Avg Stars</span>
                    </div>
                    <div className="leaderboard-metric">
                      <strong>{reviewCount}</strong>
                      <span>Reviews</span>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}

        <div className="leaderboard-full-pagination">
          <button className="ghost-button" disabled={!canGoPrev || loading} onClick={() => onPageChange(currentPage - 1)}>
            ← Prev
          </button>
          <button className="ghost-button" disabled={!canGoNext || loading} onClick={() => onPageChange(currentPage + 1)}>
            Next →
          </button>
        </div>
      </section>
    </div>
  )
}
