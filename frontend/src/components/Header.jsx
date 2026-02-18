import { useEffect, useMemo, useState } from "react"

export default function Header({
  walletAddress,
  walletUserName,
  isConnected,
  isAdmin,
  hasWalletProvider,
  onWalletAction,
  onNavigate,
  activePage,
}) {
  const [menuOpen, setMenuOpen] = useState(false)

  const shortAddress = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : ""
  const connectedLabel = walletUserName || shortAddress || "Wallet connected"
  const navItems = useMemo(() => {
    const items = [
      { key: "review", label: "Review" },
    ]

    if (isConnected) {
      items.push({ key: "profile", label: "Perfil" })
    }

    if (isAdmin) {
      items.push(
        { key: "admin-establishments", label: "Nuevo establishment" },
        { key: "admin-users", label: "Usuarios" },
        { key: "admin-points", label: "Config puntos" }
      )
    }

    return items
  }, [isAdmin, isConnected])

  useEffect(() => {
    setMenuOpen(false)
  }, [activePage, isAdmin, isConnected])

  useEffect(() => {
    if (typeof window === "undefined") return
    const handleResize = () => {
      if (window.innerWidth > 980) {
        setMenuOpen(false)
      }
    }
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  useEffect(() => {
    if (!menuOpen || typeof window === "undefined") return
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setMenuOpen(false)
      }
    }
    window.addEventListener("keydown", handleEscape)
    return () => window.removeEventListener("keydown", handleEscape)
  }, [menuOpen])

  const handleNavigate = (page) => {
    onNavigate(page)
    setMenuOpen(false)
  }

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <button className="brand brand-button" onClick={() => handleNavigate("reviews")}>
          <span className="brand-icon">★</span>
          <span className="brand-text">Syspoints</span>
        </button>

        <button
          className="menu-toggle"
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-expanded={menuOpen}
          aria-label="Toggle navigation menu"
        >
          <span />
          <span />
          <span />
        </button>
        <div className="topbar-mobile-shortcuts">
          {navItems.find((item) => item.key === "review") && (
            <button
              className={`nav-link topbar-review-link ${activePage === "review" ? "active" : ""}`}
              onClick={() => handleNavigate("review")}
            >
              {navItems.find((item) => item.key === "review").label}
            </button>
          )}
          <button className="lang-button topbar-lang-button">
            English ▾
          </button>
        </div>

        <div className={`topbar-menu ${menuOpen ? "open" : ""}`}>
          <nav className="topbar-nav">
            {navItems
              .filter((item) => item.key !== "review")
              .map((item) => (
                <button
                  key={item.key}
                  className={`nav-link ${activePage === item.key ? "active" : ""}`}
                  onClick={() => handleNavigate(item.key)}
                >
                  {item.label}
                </button>
              ))}
          </nav>

          <div className="topbar-actions">
            {/* Render the review button first, then language selector */}
            {navItems.find((item) => item.key === "review") && (
              <button
                className={`nav-link topbar-review-link ${activePage === "review" ? "active" : ""}`}
                onClick={() => handleNavigate("review")}
              >
                {navItems.find((item) => item.key === "review").label}
              </button>
            )}
            <button className="lang-button topbar-lang-button">
              English ▾
            </button>
            <button className="primary-button topbar-wallet-button" onClick={onWalletAction} title={walletAddress || "Connect wallet"}>
              {isConnected ? `${connectedLabel} | Desconectar` : hasWalletProvider ? "Connect wallet" : "Install wallet"}
            </button>
          </div>
        </div>
      </div>
      {menuOpen && <button className="topbar-backdrop" onClick={() => setMenuOpen(false)} aria-label="Close menu" />}
    </header>
  )
}
