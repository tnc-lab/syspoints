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
  onViewAllTopEstablishments,
  onSelectEstablishment,
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
      <TopEstablishmentsPanel
        loading={loadingTopEstablishments}
        entries={topEstablishments}
        onViewAll={onViewAllTopEstablishments}
        onSelectEstablishment={onSelectEstablishment}
      />
    </div>
  )
}
