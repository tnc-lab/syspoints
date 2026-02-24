import { resolveDisplayLabel } from "./leaderboardUtils"

export default function FullLeaderboardPage({
  loading,
  entries,
  meta,
  onPageChange,
  onSelectUser,
  formatShortWalletAddress,
  getDefaultAvatarUrl,
}) {
  const currentPage = Number(meta?.page || 1)
  const pageSize = Number(meta?.page_size || 20)
  const totalUsers = Number(meta?.total || 0)
  const canGoPrev = currentPage > 1
  const canGoNext = currentPage * pageSize < totalUsers
  const firstPosition = totalUsers > 0 ? (currentPage - 1) * pageSize + 1 : 0
  const lastPosition = totalUsers > 0 ? Math.min(currentPage * pageSize, totalUsers) : 0

  return (
    <div className="grid">
      <section className="panel leaderboard-full-panel">
        <div className="panel-header">
          <h3 className="panel-title">Full Ranking</h3>
          <span className="pill">{totalUsers} users</span>
        </div>

        <div className="leaderboard-full-meta">
          <span>Showing {firstPosition}-{lastPosition}</span>
          <span>Page {currentPage}</span>
        </div>

        {loading ? (
          <p>Loading full ranking...</p>
        ) : entries.length === 0 ? (
          <p>No leaderboard data available yet.</p>
        ) : (
          <div className="leaderboard-full-list">
            {entries.map((entry, index) => {
              const shortWallet = formatShortWalletAddress(entry.wallet_address)
              const displayLabel = resolveDisplayLabel(entry, shortWallet)
              const globalRank = (currentPage - 1) * pageSize + index + 1
              return (
                <article className="leaderboard-full-entry" key={entry.user_id || globalRank}>
                  <button className="leaderboard-user-button" onClick={() => onSelectUser?.(entry)} title="View user profile">
                    <div className="leaderboard-item-main">
                      <strong>#{globalRank}</strong>
                      <img
                        src={(entry.avatar_url || "").trim() || getDefaultAvatarUrl(entry.user_id || entry.wallet_address || globalRank)}
                        alt={shortWallet || "User"}
                        className="leaderboard-avatar"
                      />
                      <div className="leaderboard-full-user">
                        <strong>{displayLabel}</strong>
                        <span>{shortWallet || "No wallet"}</span>
                      </div>
                    </div>
                  </button>
                  <div className="leaderboard-full-metrics">
                    <div className="leaderboard-metric">
                      <strong>{Number(entry.total_points || 0)}</strong>
                      <span>Points</span>
                    </div>
                    <div className="leaderboard-metric">
                      <strong>{Number(entry.review_count || 0)}</strong>
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
