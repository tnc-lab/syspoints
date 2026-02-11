export default function Header({ walletAddress, walletUserName, isConnected, isAdmin, onWalletAction, onNavigate }) {
  const shortAddress = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : ""
  const connectedLabel = walletUserName || shortAddress || "Wallet connected"

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <button className="brand brand-button" onClick={() => onNavigate("reviews")}>
          <span className="brand-icon">★</span>
          <span className="brand-text">Syspoints</span>
        </button>

        <nav className="topbar-nav">
          <button className="nav-link" onClick={() => onNavigate("review")}>Write a review</button>
          {isConnected && (
            <button className="nav-link" onClick={() => onNavigate("profile")}>Ver perfil</button>
          )}
          {isAdmin && (
            <>
              <button className="nav-link" onClick={() => onNavigate("admin-establishments")}>Nuevo establishment</button>
              <button className="nav-link" onClick={() => onNavigate("admin-users")}>Lista de usuarios</button>
              <button className="nav-link" onClick={() => onNavigate("admin-points")}>Config puntos</button>
            </>
          )}
        </nav>

        <div className="topbar-actions">
          <button className="lang-button">
            English ▾
          </button>
          <button className="primary-button" onClick={onWalletAction} title={walletAddress || "Connect wallet"}>
            {isConnected ? `${connectedLabel} | Desconectar` : "Connect wallet"}
          </button>
        </div>
      </div>
    </header>
  )
}
