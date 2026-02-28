import { getMedalClass, resolveDisplayLabel } from "./leaderboardUtils"

export default function LeaderboardPanel({
  t = (key) => key,
  loading,
  entries,
  formatShortWalletAddress,
  getDefaultAvatarUrl,
  onViewFullRanking,
  onSelectUser,
}) {
  return (
    <aside className="panel">
      <div className="panel-header">
        <h3 className="panel-title">{t("home.leaderboard")}</h3>
        <span className="pill">Top</span>
      </div>
      {loading ? (
        <p>Loading leaderboard...</p>
      ) : (
        entries.map((entry, index) => {
          const shortWallet = formatShortWalletAddress(entry.wallet_address)
          const displayLabel = resolveDisplayLabel(entry, shortWallet)
          const medalClass = getMedalClass(index)
          return (
            <div className="leaderboard-entry" key={entry.user_id || index}>
              <button className="leaderboard-user-button" onClick={() => onSelectUser?.(entry)} title="View user profile">
                <div className="leaderboard-item-main">
                  <strong>#{index + 1}</strong>
                  <div className="leaderboard-avatar-wrap">
                    <img
                      src={(entry.avatar_url || "").trim() || getDefaultAvatarUrl(entry.user_id || entry.wallet_address || index)}
                      alt={shortWallet || "User"}
                      className="leaderboard-avatar"
                    />
                    {medalClass ? (
                      <span className={`leaderboard-medal ${medalClass}`} aria-label={`Top ${index + 1}`}>
                        {index + 1}
                      </span>
                    ) : null}
                  </div>
                  <span>{displayLabel}</span>
                </div>
              </button>
              <div className="pill">{entry.total_points} pts</div>
            </div>
          )
        })
      )}
      <div style={{ textAlign: "right", marginTop: "16px" }}>
        <button className="ghost-button" onClick={onViewFullRanking}>
          All
        </button>
      </div>
    </aside>
  )
}
