import LeaderboardPanel from "./LeaderboardPanel"
import TopEstablishmentsPanel from "./TopEstablishmentsPanel"

export default function HomeSidebarPanels({
  loadingLeaderboard,
  leaderboard,
  formatShortWalletAddress,
  getDefaultAvatarUrl,
  onViewFullRanking,
  onSelectUser,
  loadingTopEstablishments,
  topEstablishments,
}) {
  return (
    <div className="sidebar-panels leaderboard-panel">
      <LeaderboardPanel
        loading={loadingLeaderboard}
        entries={leaderboard}
        formatShortWalletAddress={formatShortWalletAddress}
        getDefaultAvatarUrl={getDefaultAvatarUrl}
        onViewFullRanking={onViewFullRanking}
        onSelectUser={onSelectUser}
      />
      <TopEstablishmentsPanel loading={loadingTopEstablishments} entries={topEstablishments} />
    </div>
  )
}
