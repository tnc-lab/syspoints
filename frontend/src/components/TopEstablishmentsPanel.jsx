export default function TopEstablishmentsPanel({ loading, entries }) {
  return (
    <aside className="panel">
      <div className="panel-header">
        <h3 className="panel-title">Top Establishments</h3>
        <span className="pill">Reviews</span>
      </div>
      {loading ? (
        <p>Loading top establishments...</p>
      ) : entries.length === 0 ? (
        <p>No hay reviews suficientes todavía.</p>
      ) : (
        entries.map((entry, index) => {
          const stars = Math.round(Number(entry.avg_stars || 0))
          return (
            <div className="leaderboard-entry" key={entry.id || index}>
              <div className="leaderboard-item-main">
                <strong>#{index + 1}</strong>
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
                <span>{entry.name || "Establishment"}</span>
              </div>
              <div className="leaderboard-item-meta">
                <div className="pill">{Number(entry.review_count || 0)} reviews</div>
                <div className="review-stars leaderboard-stars">
                  {"★".repeat(stars)}
                  {"☆".repeat(5 - stars)} ({Number(entry.avg_stars || 0).toFixed(1)})
                </div>
              </div>
            </div>
          )
        })
      )}
    </aside>
  )
}
