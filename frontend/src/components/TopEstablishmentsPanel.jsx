import { getMedalClass } from "./leaderboardUtils"

const truncateName = (value, max = 10) => String(value || "Establishment").trim().slice(0, max) || "Establishment"

export default function TopEstablishmentsPanel({ loading, entries, onViewAll, onSelectEstablishment }) {
  return (
    <aside className="panel">
      <div className="panel-header">
        <h3 className="panel-title">Top Establishments</h3>
        <span className="pill">Top</span>
      </div>
      {loading ? (
        <p>Loading top establishments...</p>
      ) : entries.length === 0 ? (
        <p>No hay reviews suficientes todavía.</p>
      ) : (
        entries.map((entry, index) => {
          const medalClass = getMedalClass(index)
          const shortName = truncateName(entry.name, 10)
          const averageStars = Number(entry.avg_stars || 0).toFixed(1)
          return (
            <div className="leaderboard-entry" key={entry.id || index}>
              <button className="leaderboard-user-button" onClick={() => onSelectEstablishment?.(entry)} title="View establishment">
                <div className="leaderboard-item-main">
                  <strong>#{index + 1}</strong>
                  <div className="leaderboard-avatar-wrap">
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
                    {medalClass ? (
                      <span className={`leaderboard-medal ${medalClass}`} aria-label={`Top ${index + 1}`}>
                        {index + 1}
                      </span>
                    ) : null}
                  </div>
                  <span title={entry.name || "Establishment"}>{shortName}</span>
                </div>
              </button>
              <div className="leaderboard-item-meta">
                <div className="pill">
                  {averageStars}
                  {" "}
                  ★
                </div>
              </div>
            </div>
          )
        })
      )}
      <div style={{ textAlign: "right", marginTop: "16px" }}>
        <button className="ghost-button" onClick={onViewAll}>
          All
        </button>
      </div>
    </aside>
  )
}
