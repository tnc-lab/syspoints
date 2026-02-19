import { useEffect, useState } from "react"

const STATE_LABELS = {
  idle: "Idle",
  connecting: "Connecting...",
  awaiting_signature: "Awaiting signature...",
  connected: "Connected",
  error: "Error",
  rejected: "Rejected by user",
  expired: "Session expired",
}

function WalletIcon({ option }) {
  const [imageFailed, setImageFailed] = useState(false)
  const [firstWord = "Wallet"] = String(option?.label || "Wallet").split(" ")
  return (
    <span className="wallet-option-icon" aria-hidden="true">
      {option?.icon && !imageFailed ? (
        <img src={option.icon} alt="" loading="lazy" onError={() => setImageFailed(true)} />
      ) : (
        <span className="wallet-option-fallback">{String(firstWord).slice(0, 1).toUpperCase()}</span>
      )}
    </span>
  )
}

export default function WalletModal({
  isOpen,
  isVisible,
  walletOptions,
  walletBusy,
  walletSelection,
  authFlowState,
  statusMessage,
  providerLabel,
  onClose,
  onConnectWallet,
}) {
  useEffect(() => {
    if (!isOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    const onEscape = (event) => {
      if (event.key === "Escape" && !walletBusy) onClose()
    }

    window.addEventListener("keydown", onEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", onEscape)
    }
  }, [isOpen, walletBusy, onClose])

  if (!isOpen) return null

  return (
    <div className={`wallet-modal-overlay ${isVisible ? "show" : ""}`} onClick={() => !walletBusy && onClose()} aria-hidden={!isVisible}>
      <div
        className={`wallet-modal-card ${isVisible ? "show" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Connect Wallet"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="wallet-modal-header">
          <div>
            <h3>Connect Wallet</h3>
            <p>Choose a wallet to continue</p>
          </div>
          <button className="wallet-modal-close" onClick={onClose} disabled={walletBusy} aria-label="Close wallet modal">
            ×
          </button>
        </div>

        <div className="wallet-modal-divider" />

        <div className="wallet-modal-meta">
          <span className={`wallet-state-chip state-${authFlowState || "idle"}`}>{STATE_LABELS[authFlowState] || STATE_LABELS.idle}</span>
          {providerLabel ? <span className="wallet-provider-chip">{providerLabel}</span> : null}
        </div>

        <div className="wallet-options-list">
          {walletOptions.map((option) => {
            const isSelected = walletSelection === option.key
            const isDisabled = walletBusy || (!option.available && !option.installUrl)
            const showInstall = !option.available && option.installUrl

            return (
              <button
                key={option.key}
                className={`wallet-option ${!option.available ? "is-muted" : ""} ${isSelected ? "is-selected" : ""}`}
                onClick={() => onConnectWallet(option.key)}
                disabled={isDisabled}
                aria-label={showInstall ? `Install ${option.label}` : `Connect with ${option.label}`}
              >
                <WalletIcon option={option} />
                <span className="wallet-option-main">
                  <span className="wallet-option-name">{option.label}</span>
                  <span className="wallet-option-sub">
                    {showInstall ? "Not installed" : option.description || "Popular wallet"}
                  </span>
                </span>
                <span className="wallet-option-end" aria-hidden="true">
                  {walletBusy && isSelected ? (
                    <span className="wallet-spinner" />
                  ) : showInstall ? (
                    <span className="wallet-install-pill">Install</span>
                  ) : (
                    <span className="wallet-arrow">→</span>
                  )}
                </span>
              </button>
            )
          })}
        </div>

        {statusMessage ? (
          <div className={`wallet-feedback ${authFlowState === "error" || authFlowState === "rejected" || authFlowState === "expired" ? "is-error" : ""}`}>
            {statusMessage}
          </div>
        ) : null}
      </div>
    </div>
  )
}
