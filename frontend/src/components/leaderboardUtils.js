export const getMedalClass = (index) => {
  if (index === 0) return "gold"
  if (index === 1) return "silver"
  if (index === 2) return "bronze"
  return ""
}

export const resolveDisplayLabel = (entry, shortWallet) => {
  if (entry?.leaderboard_display_mode === "name") {
    const nickname = String(entry?.name || "").trim().slice(0, 10)
    return nickname || shortWallet || "Anon"
  }
  return shortWallet || "Anon"
}
