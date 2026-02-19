import { useEffect, useMemo, useRef, useState } from "react"

export default function Header({
  walletAddress,
  walletProviderLabel,
  walletNetworkLabel,
  walletUserName,
  isConnected,
  isAdmin,
  hasWalletProvider,
  onWalletAction,
  onNavigate,
  activePage,
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [walletOpen, setWalletOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const walletRef = useRef(null)

  const visibleWalletAddress = isConnected ? walletAddress : ""
  const shortAddress = visibleWalletAddress
    ? `${visibleWalletAddress.slice(0, 6)}...${visibleWalletAddress.slice(-4)}`
    : ""
  const connectedLabel = walletProviderLabel || walletUserName || "Wallet"
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
    setWalletOpen(false)
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
    if ((!menuOpen && !walletOpen) || typeof window === "undefined") return
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setMenuOpen(false)
        setWalletOpen(false)
      }
    }
    window.addEventListener("keydown", handleEscape)
    return () => window.removeEventListener("keydown", handleEscape)
  }, [menuOpen, walletOpen])

  useEffect(() => {
    if (!walletOpen || typeof window === "undefined") return
    const handleOutside = (event) => {
      if (!walletRef.current?.contains(event.target)) {
        setWalletOpen(false)
      }
    }
    document.addEventListener("mousedown", handleOutside)
    return () => document.removeEventListener("mousedown", handleOutside)
  }, [walletOpen])

  const handleNavigate = (page) => {
    onNavigate(page)
    setMenuOpen(false)
    setWalletOpen(false)
  }

  const handleWalletClick = () => {
    if (!isConnected) {
      onWalletAction()
      return
    }
    setWalletOpen((prev) => !prev)
  }

  const handleCopyAddress = async () => {
    if (!visibleWalletAddress) return
    try {
      await navigator.clipboard.writeText(visibleWalletAddress)
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    } catch {
      setCopied(false)
    }
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
            <div className="wallet-menu-wrap" ref={walletRef}>
              <button className="primary-button topbar-wallet-button" onClick={handleWalletClick} title={visibleWalletAddress || "Login"} aria-expanded={walletOpen}>
                <span className="wallet-trigger-main">
                  <span className="wallet-trigger-label">{isConnected ? connectedLabel : "Login"}</span>
                  {isConnected ? <span className="wallet-trigger-address">{shortAddress}</span> : null}
                </span>
                {isConnected ? <span className="wallet-trigger-caret">⌄</span> : null}
              </button>

              {isConnected && walletOpen && (
                <div className="wallet-dropdown">
                  <div className="wallet-dropdown-header">
                    <strong>{connectedLabel}</strong>
                    <span className="wallet-net-chip">{walletNetworkLabel || "Unknown"}</span>
                  </div>
                  <div className="wallet-dropdown-box">
                    <div className="wallet-dropdown-address-label">Address</div>
                    <div className="wallet-dropdown-address">{walletAddress}</div>
                  </div>
                  <div className="wallet-dropdown-actions">
                    <button className="ghost-button wallet-copy-btn" onClick={handleCopyAddress}>
                      {copied ? "Copied" : "Copy"}
                    </button>
                    <button className="ghost-button wallet-disconnect-btn" onClick={onWalletAction}>
                      Disconnect
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {menuOpen && <button className="topbar-backdrop" onClick={() => setMenuOpen(false)} aria-label="Close menu" />}
    </header>
  )
}
