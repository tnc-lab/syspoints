import LeaderboardPanel from "./LeaderboardPanel"
import TopEstablishmentsPanel from "./TopEstablishmentsPanel"

export default function HomeSidebarPanels({
  t = (key) => key,
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
        t={t}
        loading={loadingLeaderboard}
        entries={leaderboard}
        formatShortWalletAddress={formatShortWalletAddress}
        getDefaultAvatarUrl={getDefaultAvatarUrl}
        onViewFullRanking={onViewFullRanking}
        onSelectUser={onSelectUser}
      />
      <TopEstablishmentsPanel
        t={t}
        loading={loadingTopEstablishments}
        entries={topEstablishments}
        onViewAll={onViewAllTopEstablishments}
        onSelectEstablishment={onSelectEstablishment}
      />
    </div>
  )
}
