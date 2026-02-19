import { useEffect, useMemo, useRef, useState } from "react"
import { ethers } from "ethers"

import Header from "./components/Header"
import Footer from "./components/Footer"
import FileUpload from "./components/FileUpload"
import WalletModal from "./components/WalletModal"
import { API_BASE, ABI, CHAIN_ID, CONTRACT_ADDRESS, EXPLORER_TX_BASE_URL, RPC_URL } from "./config"
import "./App.css"

const DEFAULT_PAGE_SIZE = 6
const MAX_ESTABLISHMENT_IMAGE_INPUT_BYTES = 2_000_000
const ESTABLISHMENT_IMAGE_MAX_DIMENSION = 960
const MAX_WALLET_LOGO_INPUT_BYTES = 1_000_000
const WALLET_LOGO_STANDARD_SIZE = 256
const MAX_REVIEW_EVIDENCE_IMAGES = 3
const MIN_REVIEW_EVIDENCE_IMAGES = 1
const MAX_REVIEW_TITLE_WORDS = 12
const HOME_REVIEW_DESCRIPTION_MAX_CHARS = 200
const MAP_SEARCH_RESULT_LIMIT = 6
const NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse"
const OSM_EMBED_BASE_URL = "https://www.openstreetmap.org/export/embed.html"
const DEFAULT_MAP_VIEW = {
  latitude: -12.0464,
  longitude: -77.0428,
}
const ESTABLISHMENT_CATEGORIES = [
  "Restaurant",
  "Cafe",
  "Retail",
  "Supermarket",
  "Pharmacy",
  "Hotel",
  "Gym",
  "Salon",
  "Electronics",
  "Services",
]
const REVIEW_SUCCESS_MESSAGE = "Review submitted and anchored on-chain."
const DEFAULT_METAMASK_LOGO = "https://cdn.jsdelivr.net/gh/MetaMask/brand-resources@master/SVG/metamask-fox.svg"
const DEFAULT_PALI_LOGO = "https://www.paliwallet.com/images/logo/logo-white.svg"
const WALLET_OPTION_CONFIG = {
  metamask: {
    key: "metamask",
    label: "MetaMask",
    description: "Browser extension",
    icon: DEFAULT_METAMASK_LOGO,
    installUrl: "https://metamask.io/download/",
  },
  pali: {
    key: "pali",
    label: "PaliWallet",
    description: "Browser extension",
    icon: DEFAULT_PALI_LOGO,
    installUrl: "https://www.paliwallet.com/",
  },
  other: {
    key: "other",
    label: "Other Wallet",
    description: "Injected EVM provider",
    icon: "",
    installUrl: "",
  },
}

const EIP6963_REGISTRY_KEY = "__syspoints_eip6963_registry"

const getEip6963Registry = () => {
  if (typeof window === "undefined") return []
  const current = window[EIP6963_REGISTRY_KEY]
  return Array.isArray(current) ? current : []
}

const registerEip6963Provider = (detail) => {
  if (typeof window === "undefined") return
  const provider = detail?.provider
  if (!provider || typeof provider !== "object" || typeof provider.request !== "function") return
  const info = detail?.info && typeof detail.info === "object" ? detail.info : {}
  const current = getEip6963Registry()
  const existingIndex = current.findIndex((entry) => entry?.provider === provider)
  if (existingIndex >= 0) {
    current[existingIndex] = { ...current[existingIndex], info: { ...current[existingIndex]?.info, ...info }, provider }
    window[EIP6963_REGISTRY_KEY] = current
    return
  }
  window[EIP6963_REGISTRY_KEY] = [...current, { info, provider }]
}

const getEip6963Info = (provider) => {
  if (!provider) return null
  const entry = getEip6963Registry().find((candidate) => candidate?.provider === provider)
  return entry?.info || null
}

const getInjectedProviders = () => {
  if (typeof window === "undefined") return []

  const candidates = []
  const maybePush = (provider) => {
    if (!provider || typeof provider !== "object") return
    if (typeof provider.request !== "function") return
    candidates.push(provider)
  }

  if (window.ethereum) {
    if (Array.isArray(window.ethereum.providers) && window.ethereum.providers.length > 0) {
      window.ethereum.providers.forEach((provider) => maybePush(provider))
    }
    maybePush(window.ethereum)
  }

  getEip6963Registry().forEach((entry) => maybePush(entry?.provider))

  // Common non-standard globals used by some wallet extensions.
  maybePush(window.pali)
  maybePush(window.paliWallet)
  maybePush(window.paliEthereum)
  maybePush(window.paliwallet)

  // Heuristic scan for globals that look like Pali providers.
  Object.keys(window).forEach((key) => {
    if (!/pali/i.test(key)) return
    maybePush(window[key])
  })

  return Array.from(new Set(candidates))
}

const providerIdentityText = (provider) =>
  String(
    provider?.name ||
    provider?.providerInfo?.name ||
    getEip6963Info(provider)?.name ||
    provider?.providerInfo?.rdns ||
    getEip6963Info(provider)?.rdns ||
    provider?.providerInfo?.id ||
    getEip6963Info(provider)?.id ||
    provider?.providerInfo?.uuid ||
    getEip6963Info(provider)?.uuid ||
    provider?._events?.connect?.info?.name ||
    ""
  ).toLowerCase()

const isKnownPaliGlobal = (provider) => {
  if (typeof window === "undefined" || !provider) return false

  const directCandidates = [
    window.pali,
    window.paliWallet,
    window.paliwallet,
    window.paliEthereum,
  ]
  if (directCandidates.some((candidate) => candidate === provider)) return true

  const nestedCandidates = directCandidates.flatMap((candidate) => [
    candidate?.ethereum,
    candidate?.provider,
    candidate?.walletProvider,
  ])
  return nestedCandidates.some((candidate) => candidate === provider)
}

const detectProviderType = (provider) => {
  if (!provider) return "other"
  const identity = providerIdentityText(provider)
  if (
    provider?.isPaliWallet ||
    provider?.isPali ||
    provider?.isPaliwallet ||
    provider?.isPALI ||
    isKnownPaliGlobal(provider) ||
    identity.includes("paliwallet") ||
    identity.includes("pali wallet") ||
    identity.includes("pali") ||
    identity.includes("syscoin") ||
    identity.includes("pollum") ||
    identity.includes("com.paliwallet") ||
    identity.includes("io.paliwallet")
  ) {
    return "pali"
  }
  if (
    provider?.isMetaMask &&
    !provider?.isCoinbaseWallet &&
    !provider?.isRabby &&
    !provider?.isBraveWallet &&
    !identity.includes("pali")
  ) {
    return "metamask"
  }
  return "other"
}

const isPaliProvider = (provider) => detectProviderType(provider) === "pali"
const isMetaMaskProvider = (provider) => detectProviderType(provider) === "metamask"

const eip6963InfoText = (info) =>
  String(
    info?.name ||
    info?.rdns ||
    info?.id ||
    info?.uuid ||
    ""
  ).toLowerCase()

const isEip6963MetaMaskInfo = (info) => {
  const text = eip6963InfoText(info)
  if (!text) return false
  if (!/metamask/i.test(text) && !/io\.metamask/i.test(text)) return false
  return !/pali|pollum|syscoin/i.test(text)
}

const isEip6963PaliInfo = (info) => /pali|paliwallet|pollum|syscoin/i.test(eip6963InfoText(info))

const getPaliSpecificProviders = () => {
  if (typeof window === "undefined") return []

  const candidates = []
  const maybePush = (provider) => {
    if (!provider || typeof provider !== "object") return
    if (typeof provider.request !== "function") return
    candidates.push(provider)
  }

  const directCandidates = [
    window.pali,
    window.paliWallet,
    window.paliwallet,
    window.paliEthereum,
  ]
  directCandidates.forEach((candidate) => {
    maybePush(candidate)
    maybePush(candidate?.ethereum)
    maybePush(candidate?.provider)
    maybePush(candidate?.walletProvider)
  })

  return Array.from(new Set(candidates))
}

const resolveWalletProvider = (walletType) => {
  const eip6963Entries = getEip6963Registry()
  const providers = getInjectedProviders()
  if (!providers.length) return null

  if (walletType === "metamask") {
    const eipMetaMask = eip6963Entries.find((entry) => isEip6963MetaMaskInfo(entry?.info))
    if (eipMetaMask?.provider) return eipMetaMask.provider
    return providers.find((provider) => isMetaMaskProvider(provider) && !isKnownPaliGlobal(provider)) || null
  }

  if (walletType === "pali") {
    const eipPali = eip6963Entries.find((entry) => isEip6963PaliInfo(entry?.info))
    if (eipPali?.provider) return eipPali.provider
    const paliSpecificProviders = getPaliSpecificProviders()
    return (
      paliSpecificProviders.find((provider) => isPaliProvider(provider)) ||
      providers.find((provider) => isPaliProvider(provider) || isKnownPaliGlobal(provider)) ||
      null
    )
  }

  if (walletType === "other") {
    const eipOther = eip6963Entries.find((entry) => detectProviderType(entry?.provider) === "other")
    if (eipOther?.provider) return eipOther.provider
    return providers.find((provider) => detectProviderType(provider) === "other") || null
  }

  return null
}

const normalizeAddress = (value) => {
  try {
    return value ? ethers.getAddress(value) : ""
  } catch {
    return ""
  }
}

const normalizeDomain = (value) => String(value || "").trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "")

const buildSiweMessage = ({
  domain,
  address,
  uri,
  chainId,
  nonce,
  issuedAt,
  expirationTime,
  statement = "Sign in to Syspoints with your wallet.",
}) => {
  const safeStatement = String(statement || "").trim()
  return `${domain} wants you to sign in with your Ethereum account:\n${address}\n\n${safeStatement ? `${safeStatement}\n` : ""}URI: ${uri}\nVersion: 1\nChain ID: ${chainId}\nNonce: ${nonce}\nIssued At: ${issuedAt}\nExpiration Time: ${expirationTime}`
}

const truncateWithEllipsis = (value, maxChars) => {
  const text = String(value || "")
  if (text.length <= maxChars) return text
  return `${text.slice(0, maxChars)}...`
}

const getWalletErrorMessage = (error, fallback = "Wallet connection failed.") => {
  const code = String(error?.code || "")
  const nestedCode = String(error?.info?.error?.code || "")
  const message = String(error?.message || "")
  const nestedMessage = String(error?.info?.error?.message || "")
  const combined = `${message} ${nestedMessage}`.toLowerCase()

  if (
    code === "4001" ||
    nestedCode === "4001" ||
    code === "ACTION_REJECTED" ||
    combined.includes("user rejected") ||
    combined.includes("ethers-user-denied") ||
    combined.includes("rejected")
  ) {
    return "Firma cancelada en la wallet."
  }

  if (error?.code === -32002) return "Wallet request already pending. Open your wallet extension."
  if (error?.code === 4100) return "Wallet access not authorized. Approve this dApp in your wallet."
  if (error?.message === "No wallet account available.") return "No account found in this wallet. Create or import an account first."
  return error?.message || fallback
}

const toNumberOrNull = (value) => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

const buildEmbeddedMapUrl = ({ latitude, longitude }) => {
  const lat = toNumberOrNull(latitude)
  const lon = toNumberOrNull(longitude)
  if (lat == null || lon == null) return ""
  const delta = 0.01
  const bbox = [lon - delta, lat - delta, lon + delta, lat + delta].join(",")
  return `${OSM_EMBED_BASE_URL}?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${lat}%2C${lon}`
}

const buildLocalPlaceholderImage = ({ title = "Establishment" } = {}) => {
  const safeTitle = String(title || "Establishment").replace(/[<>&"]/g, "")
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="960" height="640" viewBox="0 0 960 640">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#fde68a"/>
          <stop offset="100%" stop-color="#93c5fd"/>
        </linearGradient>
      </defs>
      <rect width="960" height="640" fill="url(#g)"/>
      <rect x="72" y="80" width="816" height="480" rx="24" fill="rgba(255,255,255,0.65)"/>
      <text x="480" y="306" text-anchor="middle" fill="#111827" font-size="42" font-family="sans-serif" font-weight="700">${safeTitle}</text>
      <text x="480" y="354" text-anchor="middle" fill="#374151" font-size="24" font-family="sans-serif">Suggested image</text>
    </svg>
  `
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

const getChainProofErrorMessage = (error) => {
  const message = String(error?.message || "").trim()
  if (!message || /failed to fetch/i.test(message)) {
    return "La verificación en blockchain no está disponible temporalmente."
  }
  if (
    /method only available when connected on evm chains/i.test(message) ||
    /could not coalesce error/i.test(message)
  ) {
    return "No se puede verificar en cadena con el provider actual. Conecta una wallet EVM en la red correcta o configura VITE_RPC_URL."
  }
  return message
}

const TAG_COLORS = [
  { background: "#fee2e2", color: "#991b1b" },
  { background: "#dbeafe", color: "#1e3a8a" },
  { background: "#dcfce7", color: "#14532d" },
  { background: "#fef3c7", color: "#92400e" },
  { background: "#ede9fe", color: "#5b21b6" },
  { background: "#cffafe", color: "#155e75" },
]

const parseTokenPayload = (jwtToken) => {
  if (!jwtToken) return null
  try {
    return JSON.parse(atob(jwtToken.split(".")[1]))
  } catch {
    return null
  }
}

function App() {
  const getNetworkLabel = ({ chainId, name }) => {
    const numericChainId = Number(chainId)
    const knownNetworks = {
      57: "Syscoin Mainnet",
      5700: "Syscoin Testnet",
      57042: "Syscoin Devnet",
    }
    if (knownNetworks[numericChainId]) return knownNetworks[numericChainId]
    if (name && name !== "unknown") return String(name)
    return Number.isFinite(numericChainId) ? `Chain ${numericChainId}` : "Unknown network"
  }

  const identifyWalletLabel = (provider, fallback = "Wallet") => {
    if (isPaliProvider(provider)) return "PaliWallet"
    if (isMetaMaskProvider(provider)) return "MetaMask"
    return fallback || "Wallet"
  }

  const [walletAddress, setWalletAddress] = useState("")
  const [wrongNetwork, setWrongNetwork] = useState(false)
  const [token, setToken] = useState(localStorage.getItem("syspoints_token") || "")
  const [currentUserRole, setCurrentUserRole] = useState(() => {
    const payload = parseTokenPayload(localStorage.getItem("syspoints_token") || "")
    return String(payload?.role || "").trim().toLowerCase()
  })
  const [walletUserName, setWalletUserName] = useState(() => {
    const fromStorage = localStorage.getItem("syspoints_user_name") || ""
    if (fromStorage) return fromStorage
    const payload = parseTokenPayload(localStorage.getItem("syspoints_token") || "")
    return payload?.name || ""
  })
  const [connectedWalletLabel, setConnectedWalletLabel] = useState(() => localStorage.getItem("syspoints_wallet_label") || "")
  const [walletNetworkLabel, setWalletNetworkLabel] = useState("")
  const [authStatus, setAuthStatus] = useState("")
  const [profileStatus, setProfileStatus] = useState("")
  const [profileBusy, setProfileBusy] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [showWalletModal, setShowWalletModal] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [walletModalStatus, setWalletModalStatus] = useState("")
  const [walletFlowStep, setWalletFlowStep] = useState("idle")
  const [authFlowState, setAuthFlowState] = useState(token ? "connected" : "idle")
  const [walletSelection, setWalletSelection] = useState("")
  const [showTxModal, setShowTxModal] = useState(false)
  const [txModalVisible, setTxModalVisible] = useState(false)
  const [submittingReview, setSubmittingReview] = useState(false)
  const [reviewSubmissionState, setReviewSubmissionState] = useState({
    key: "",
    signature: "",
  })
  const [reviewTx, setReviewTx] = useState({
    step: "idle",
    message: "",
    points: 0,
    txHash: "",
    explorerUrl: "",
  })
  const [walletBusy, setWalletBusy] = useState(false)
  const [, setWalletProviderScanTick] = useState(0)
  const [activePage, setActivePage] = useState("reviews")
  const activeWalletProviderRef = useRef(null)

  const [profile, setProfile] = useState({
    name: "",
    email: "",
    avatar_url: "",
  })

  const [reviewForm, setReviewForm] = useState({
    establishment_id: "",
    title: "",
    description: "",
    stars: 0,
    price: "",
    purchase_url: "",
    tags: "",
    evidence_images: [],
  })
  const [locationSearch, setLocationSearch] = useState({
    query: "",
    loading: false,
    error: "",
    results: [],
    selected: null,
    resolvedId: "",
    resolving: false,
    geolocating: false,
    mapCenter: { ...DEFAULT_MAP_VIEW },
  })
  const [imageSuggestions, setImageSuggestions] = useState({
    loading: false,
    error: "",
    items: [],
    selected: "",
  })
  const [imageSourceMode, setImageSourceMode] = useState("existing")
  const [uploadingSelectedEstablishmentImage, setUploadingSelectedEstablishmentImage] = useState(false)
  const [establishmentCategory, setEstablishmentCategory] = useState("")
  const [reviewWizardStep, setReviewWizardStep] = useState(1)
  const [reviewWizardStatus, setReviewWizardStatus] = useState("")
  const [reviewCaptcha, setReviewCaptcha] = useState({
    loading: false,
    requiresCaptcha: false,
    challenge: "",
    token: "",
    expiresAt: "",
    answer: "",
    error: "",
  })
  const [uploadingReviewEvidence, setUploadingReviewEvidence] = useState(false)

  const [reviews, setReviews] = useState([])
  const [reviewsMeta, setReviewsMeta] = useState({ page: 1, page_size: DEFAULT_PAGE_SIZE, total: 0 })
  const [leaderboard, setLeaderboard] = useState([])
  const [leaderMeta, setLeaderMeta] = useState({ page: 1, page_size: 5, total: 0 })
  const [topEstablishments, setTopEstablishments] = useState([])
  const [loadingReviews, setLoadingReviews] = useState(false)
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false)
  const [loadingTopEstablishments, setLoadingTopEstablishments] = useState(false)
  const [establishments, setEstablishments] = useState([])
  const [reviewsView, setReviewsView] = useState("list")
  const [selectedReview, setSelectedReview] = useState(null)
  const [loadingSelectedReview, setLoadingSelectedReview] = useState(false)
  const [loadingReviewId, setLoadingReviewId] = useState("")
  const [reviewChainInfo, setReviewChainInfo] = useState({
    loading: false,
    anchored: false,
    txHash: "",
    blockNumber: null,
    blockTimestamp: null,
    unavailable: "",
    error: "",
  })
  const [adminStatus, setAdminStatus] = useState("")
  const [adminUsers, setAdminUsers] = useState([])
  const [loadingAdminUsers, setLoadingAdminUsers] = useState(false)
  const [pointsConfig, setPointsConfig] = useState({
    image_points_yes: 0,
    image_points_no: 0,
    description_points_gt_200: 0,
    description_points_lte_200: 0,
    stars_points_yes: 0,
    stars_points_no: 0,
    price_points_lt_100: 0,
    price_points_gte_100: 0,
    default_user_avatar_url: "",
    metamask_wallet_logo_url: "",
    pali_wallet_logo_url: "",
    other_wallet_logo_url: "",
  })
  const [loadingPointsConfig, setLoadingPointsConfig] = useState(false)
  const [uploadingDefaultAvatar, setUploadingDefaultAvatar] = useState(false)
  const [uploadingWalletLogoKey, setUploadingWalletLogoKey] = useState("")
  const [newEstablishment, setNewEstablishment] = useState({
    name: "",
    category: "",
    image_url: "",
    address: "",
    country: "",
    state_region: "",
    district: "",
    latitude: "",
    longitude: "",
  })
  const [uploadingEstablishmentImage, setUploadingEstablishmentImage] = useState(false)
  const [editingEstablishmentId, setEditingEstablishmentId] = useState("")
  const [editingEstablishment, setEditingEstablishment] = useState({
    name: "",
    category: "",
    image_url: "",
    address: "",
    country: "",
    state_region: "",
    district: "",
    latitude: "",
    longitude: "",
  })
  const [savingEstablishmentEdition, setSavingEstablishmentEdition] = useState(false)

  const getWalletProvider = () => {
    const provider = activeWalletProviderRef.current || (typeof window !== "undefined" ? window.ethereum : null)
    if (!provider) return null
    return new ethers.BrowserProvider(provider)
  }

  const readProvider = useMemo(() => {
    if (!RPC_URL) return null
    return new ethers.JsonRpcProvider(RPC_URL)
  }, [])
  const hasWalletProvider = getInjectedProviders().length > 0
  const walletOptions = [
    {
      ...WALLET_OPTION_CONFIG.metamask,
      icon: pointsConfig.metamask_wallet_logo_url || DEFAULT_METAMASK_LOGO,
      available: Boolean(resolveWalletProvider("metamask")),
    },
    {
      ...WALLET_OPTION_CONFIG.pali,
      icon: pointsConfig.pali_wallet_logo_url || DEFAULT_PALI_LOGO,
      available: Boolean(resolveWalletProvider("pali")),
    },
    {
      ...WALLET_OPTION_CONFIG.other,
      icon: pointsConfig.other_wallet_logo_url || "",
      available: Boolean(resolveWalletProvider("other")),
    },
  ]
  const explorerBaseUrl = useMemo(() => {
    const value = String(EXPLORER_TX_BASE_URL || "").trim()
    if (!value) return ""
    return value.replace(/\/tx\/?$/i, "").replace(/\/+$/, "")
  }, [])

  const clearSession = () => {
    setToken("")
    setCurrentUserRole("")
    setWalletUserName("")
    setConnectedWalletLabel("")
    setWalletNetworkLabel("")
    setAuthFlowState("idle")
    localStorage.removeItem("syspoints_token")
    localStorage.removeItem("syspoints_user_name")
    localStorage.removeItem("syspoints_wallet_label")
  }

  useEffect(() => {
    const updateNetwork = async () => {
      const provider = getWalletProvider()
      if (!provider) return
      try {
        const network = await provider.getNetwork()
        setWrongNetwork(Number(network.chainId) !== Number(import.meta.env.VITE_CHAIN_ID))
        setWalletNetworkLabel(getNetworkLabel({ chainId: Number(network.chainId), name: network.name }))
      } catch {
        setWrongNetwork(false)
        setWalletNetworkLabel("")
      }
    }

    updateNetwork()
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return

    const requestEip6963Providers = () => {
      window.dispatchEvent(new Event("eip6963:requestProvider"))
    }

    const refreshWalletProviders = () => setWalletProviderScanTick((prev) => prev + 1)
    const refreshWalletProvidersAndRequest = () => {
      refreshWalletProviders()
      requestEip6963Providers()
    }
    const handleEip6963Announcement = (event) => {
      registerEip6963Provider(event?.detail)
      refreshWalletProviders()
    }

    window.addEventListener("eip6963:announceProvider", handleEip6963Announcement)
    const timer = window.setInterval(refreshWalletProviders, 1500)
    window.addEventListener("ethereum#initialized", refreshWalletProvidersAndRequest)
    window.addEventListener("focus", refreshWalletProvidersAndRequest)
    requestEip6963Providers()
    return () => {
      window.clearInterval(timer)
      window.removeEventListener("eip6963:announceProvider", handleEip6963Announcement)
      window.removeEventListener("ethereum#initialized", refreshWalletProvidersAndRequest)
      window.removeEventListener("focus", refreshWalletProvidersAndRequest)
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    const observedProvider = activeWalletProviderRef.current || window.ethereum
    if (!observedProvider || typeof observedProvider.request !== "function") return

    const tokenWalletAddress = normalizeAddress(parseTokenPayload(token)?.wallet_address)

    const handleAccountsChanged = (accounts) => {
      const nextAddress = normalizeAddress(accounts?.[0] || "")
      const addressChanged =
        nextAddress &&
        walletAddress &&
        nextAddress.toLowerCase() !== walletAddress.toLowerCase()

      setWalletAddress(nextAddress)
      if (!nextAddress || addressChanged) {
        setWrongNetwork(false)
        clearSession()
        if (addressChanged) {
          setAuthStatus("Wallet account changed. Please sign in again.")
        }
        return
      }

      if (!connectedWalletLabel) {
        const detectedLabel = identifyWalletLabel(observedProvider, "Wallet")
        setConnectedWalletLabel(detectedLabel)
        localStorage.setItem("syspoints_wallet_label", detectedLabel)
      }

      if (tokenWalletAddress && tokenWalletAddress.toLowerCase() !== nextAddress.toLowerCase()) {
        clearSession()
        setAuthStatus("Wallet account does not match current session. Please sign in again.")
      }
    }

    const handleChainChanged = (chainId) => {
      const parsedChainId = typeof chainId === "string" ? parseInt(chainId, 16) : Number(chainId)
      setWrongNetwork(Number(parsedChainId) !== Number(import.meta.env.VITE_CHAIN_ID))
      setWalletNetworkLabel(getNetworkLabel({ chainId: parsedChainId }))
    }

    const handleDisconnect = () => {
      setWalletAddress("")
      setWrongNetwork(false)
      setWalletNetworkLabel("")
      clearSession()
      setAuthStatus("Wallet disconnected.")
    }

    observedProvider.request({ method: "eth_accounts" }).then(handleAccountsChanged).catch(() => {})

    const canSubscribe = typeof observedProvider.on === "function"
    const removeListener = typeof observedProvider.removeListener === "function"
      ? observedProvider.removeListener.bind(observedProvider)
      : typeof observedProvider.off === "function"
        ? observedProvider.off.bind(observedProvider)
        : null

    if (canSubscribe) {
      observedProvider.on("accountsChanged", handleAccountsChanged)
      observedProvider.on("chainChanged", handleChainChanged)
      observedProvider.on("disconnect", handleDisconnect)
    }

    return () => {
      if (!removeListener) return
      removeListener("accountsChanged", handleAccountsChanged)
      removeListener("chainChanged", handleChainChanged)
      removeListener("disconnect", handleDisconnect)
    }
  }, [connectedWalletLabel, walletAddress, token, walletSelection, walletBusy])

  useEffect(() => {
    fetchReviews(1)
    fetchLeaderboard(1)
    fetchTopEstablishments(1)
    fetchEstablishments()
    fetchPublicWalletBranding()
  }, [])

  const authPayload = useMemo(() => parseTokenPayload(token), [token])
  const userId = authPayload?.sub || null
  const tokenRole = String(authPayload?.role || "").trim().toLowerCase()
  const isAdmin = currentUserRole === "admin" || tokenRole === "admin"
  const establishmentsById = useMemo(() => {
    const map = new Map()
    establishments.forEach((est) => map.set(est.id, est))
    return map
  }, [establishments])
  const selectedEstablishment = useMemo(() => {
    if (locationSearch.selected) return locationSearch.selected
    return establishmentsById.get(reviewForm.establishment_id) || null
  }, [establishmentsById, reviewForm.establishment_id, locationSearch.selected])

  const handleCategorySelection = (nextCategory) => {
    const normalizedCategory = String(nextCategory || "").trim()
    if (normalizedCategory === String(establishmentCategory || "").trim()) return

    setEstablishmentCategory(normalizedCategory)
    setReviewForm((prev) => ({
      ...prev,
      establishment_id: "",
      title: "",
      description: "",
      stars: 0,
      price: "",
      purchase_url: "",
      tags: "",
      evidence_images: [],
    }))
    setLocationSearch({
      query: "",
      loading: false,
      error: "",
      results: [],
      selected: null,
      resolvedId: "",
      resolving: false,
      geolocating: false,
      mapCenter: { ...DEFAULT_MAP_VIEW },
    })
    setImageSuggestions({
      loading: false,
      error: "",
      items: [],
      selected: "",
    })
    setImageSourceMode("existing")
    setReviewWizardStep(normalizedCategory ? 2 : 1)
  }

  const apiFetch = async (path, options = {}) => {
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    }

    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    })

    const data = await response.json().catch(() => null)
    if (!response.ok) {
      throw new Error(data?.error?.message || "Request failed")
    }
    return data
  }

  const fetchCurrentUser = async (authToken = token) => {
    if (!authToken) return null
    const response = await fetch(`${API_BASE}/users/me`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
    })

    const data = await response.json().catch(() => null)
    if (!response.ok) {
      throw new Error(data?.error?.message || "Failed to load user profile")
    }
    return data
  }

  const ensureNetwork = async (providerOverride = null) => {
    const chainId = Number(import.meta.env.VITE_CHAIN_ID)
    const provider = providerOverride || activeWalletProviderRef.current || (typeof window !== "undefined" ? window.ethereum : null)
    if (!provider || !chainId) return
    const hexChainId = `0x${chainId.toString(16)}`

    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: hexChainId }],
      })
    } catch (err) {
      if (err?.code === 4001) {
        throw new Error("Network switch rejected in wallet.")
      }
      if (err.code === 4902) {
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: hexChainId,
              chainName: "Syscoin Devnet",
              rpcUrls: [import.meta.env.VITE_RPC_URL],
              nativeCurrency: {
                name: "tSYS",
                symbol: "tSYS",
                decimals: 18,
              },
              blockExplorerUrls: EXPLORER_TX_BASE_URL ? [String(EXPLORER_TX_BASE_URL).replace(/\/tx\/?$/i, "")] : [],
            },
          ],
        })
      } else {
        throw err
      }
    }
  }

  const persistSession = (nextToken, fallbackName = "") => {
    setToken(nextToken)
    localStorage.setItem("syspoints_token", nextToken)
    const payload = parseTokenPayload(nextToken)
    setCurrentUserRole(String(payload?.role || "").trim().toLowerCase())
    const nextName = payload?.name || fallbackName || ""
    setWalletUserName(nextName)
    if (nextName) {
      localStorage.setItem("syspoints_user_name", nextName)
    } else {
      localStorage.removeItem("syspoints_user_name")
    }
  }

  const hydrateProfileFromUser = (user) => {
    if (!user) return
    setCurrentUserRole(String(user.role || "").trim().toLowerCase())
    setProfile({
      name: user.name || "",
      email: user.email || "",
      avatar_url: user.avatar_url || "",
    })
    if (user.name) {
      setWalletUserName(user.name)
      localStorage.setItem("syspoints_user_name", user.name)
    }
  }

  const signInWithWallet = async (address, fallbackName = "", providerOverride = null) => {
    const normalizedAddress = normalizeAddress(address)
    const providerSource = providerOverride || activeWalletProviderRef.current || (typeof window !== "undefined" ? window.ethereum : null)
    if (!normalizedAddress || !providerSource) {
      throw new Error("Connect your wallet first.")
    }
    const provider = new ethers.BrowserProvider(providerSource)

    setAuthFlowState("connecting")
    await ensureNetwork(providerSource)
    const browserDomain = typeof window !== "undefined" ? normalizeDomain(window.location.host) : ""
    const browserOrigin = typeof window !== "undefined" ? window.location.origin : ""
    const nonceParams = new URLSearchParams({
      address: normalizedAddress,
      chain_id: String(CHAIN_ID || ""),
      domain: browserDomain,
      uri: browserOrigin,
    })
    const nonceResponse = await apiFetch(`/auth/siwe/nonce?${nonceParams.toString()}`)

    const signer = await provider.getSigner(normalizedAddress)
    setAuthFlowState("awaiting_signature")
    const message = buildSiweMessage({
      domain: nonceResponse.domain || browserDomain,
      address: normalizedAddress,
      uri: nonceResponse.uri || browserOrigin,
      chainId: Number(nonceResponse.chain_id || CHAIN_ID),
      nonce: nonceResponse.nonce,
      issuedAt: nonceResponse.issued_at,
      expirationTime: nonceResponse.expires_at,
      statement: nonceResponse.statement || "Sign in to Syspoints with your wallet.",
    })
    const signature = await signer.signMessage(message)
    const tokenResponse = await apiFetch("/auth/siwe/verify", {
      method: "POST",
      body: JSON.stringify({ message, signature }),
    })

    persistSession(tokenResponse.access_token, fallbackName)
    try {
      const currentUser = await fetchCurrentUser(tokenResponse.access_token)
      hydrateProfileFromUser(currentUser)
    } catch {
      // keep session active even if profile fetch fails
    }
    setAuthStatus("Signed in successfully.")
    setAuthFlowState("connected")
    return { ok: true }
  }

  const connectWallet = async (walletType = "other") => {
    const selectedOption = WALLET_OPTION_CONFIG[walletType] || WALLET_OPTION_CONFIG.other
    const provider = resolveWalletProvider(walletType)
    if (!provider) {
      if (selectedOption.installUrl) {
        if (typeof window !== "undefined") {
          window.open(selectedOption.installUrl, "_blank", "noopener,noreferrer")
        }
        setWalletModalStatus(`${selectedOption.label} is not installed in this browser. We opened the install page.`)
      } else if (!hasWalletProvider) {
        setWalletModalStatus("Wallet provider not found. Install MetaMask or PaliWallet.")
      } else {
        setWalletModalStatus("No compatible injected wallet found for this option.")
      }
      return
    }

    const providerType = detectProviderType(provider)
    if ((walletType === "metamask" || walletType === "pali") && providerType !== walletType) {
      setWalletModalStatus(
        `No se encontró un provider independiente para ${selectedOption.label}. Abre la dApp dentro del navegador de esa wallet o desactiva temporalmente otras extensiones EVM.`
      )
      return
    }

    activeWalletProviderRef.current = provider
    setWalletSelection(walletType)
    setWalletBusy(true)
    setAuthFlowState("connecting")
    setWalletFlowStep("network")
    setWalletModalStatus("")
    try {
      setWalletModalStatus("Switching network to Syscoin Devnet...")
      await ensureNetwork(provider)

      setWalletFlowStep("accounts")
      setWalletModalStatus("Requesting wallet account...")
      const accounts = await provider.request({ method: "eth_requestAccounts" })
      const address = normalizeAddress(accounts?.[0] || "")
      if (!address) {
        throw new Error("No wallet account available.")
      }

      setWalletAddress(address)
      const detectedLabel = identifyWalletLabel(provider, selectedOption.label)
      setConnectedWalletLabel(detectedLabel)
      localStorage.setItem("syspoints_wallet_label", detectedLabel)
      try {
        const connectedNetwork = await (new ethers.BrowserProvider(provider)).getNetwork()
        setWalletNetworkLabel(getNetworkLabel({ chainId: Number(connectedNetwork.chainId), name: connectedNetwork.name }))
      } catch {
        setWalletNetworkLabel("")
      }
      setWalletFlowStep("signin")
      setWalletModalStatus("Please sign the login message in your wallet.")
      await signInWithWallet(address, "", provider)

      setWalletFlowStep("idle")
      setWalletModalStatus("Wallet conectada correctamente.")
      setAuthFlowState("connected")
      setTimeout(() => closeWalletModal(), 250)
    } catch (error) {
      setWalletFlowStep("idle")
      const message = getWalletErrorMessage(error, `${selectedOption.label} connection failed.`)
      const isRejected = /cancelada|rejected|denied/i.test(String(message || ""))
      setAuthFlowState(isRejected ? "rejected" : "error")
      setWalletModalStatus(message)
      setAuthStatus(message)
    } finally {
      setWalletBusy(false)
      setWalletSelection("")
    }
  }

  const openWalletModal = () => {
    setAuthFlowState("idle")
    setWalletModalStatus("")
    setShowWalletModal(true)
    setTimeout(() => setModalVisible(true), 10)
  }

  const disconnectWallet = () => {
    activeWalletProviderRef.current = null
    setWalletAddress("")
    setWrongNetwork(false)
    clearSession()
    setActivePage("reviews")
    setAuthStatus("Wallet disconnected.")
  }

  const handleWalletAction = () => {
    if (walletAddress && token) {
      disconnectWallet()
      return
    }
    openWalletModal()
  }

  const closeWalletModal = () => {
    setWalletModalStatus("")
    setWalletFlowStep("idle")
    setWalletSelection("")
    setWalletBusy(false)
    setModalVisible(false)
    setTimeout(() => setShowWalletModal(false), 200)
  }

  const openReviewTxModal = (payload = {}) => {
    setReviewTx((prev) => ({ ...prev, ...payload }))
    setShowTxModal(true)
    setTimeout(() => setTxModalVisible(true), 10)
  }

  const closeReviewTxModal = () => {
    if (reviewTx.step === "pending" || reviewTx.step === "signing") return
    setTxModalVisible(false)
    setTimeout(() => setShowTxModal(false), 200)
  }

  const detectProvider = () => {
    const providers = getInjectedProviders()
    if (!providers.length) return "No provider detected"
    const labels = []
    if (providers.some((provider) => isMetaMaskProvider(provider))) labels.push("MetaMask")
    if (providers.some((provider) => isPaliProvider(provider))) labels.push("PaliWallet")
    if (providers.some((provider) => !isMetaMaskProvider(provider) && !isPaliProvider(provider))) labels.push("Other Wallet")
    return labels.length ? `${labels.join(" + ")} detected` : "Injected wallet detected"
  }

  const countWords = (text) =>
    String(text || "").trim().split(/\s+/).filter(Boolean).length
  const hasSelectedCategory = Boolean(String(establishmentCategory || "").trim())
  const hasConfirmedEstablishment = Boolean(String(reviewForm.establishment_id || "").trim())
  const reviewTitleWordCount = countWords(reviewForm.title)
  const hasValidReviewTitle =
    Boolean(String(reviewForm.title || "").trim()) && reviewTitleWordCount <= MAX_REVIEW_TITLE_WORDS

  const goToNextWizardStep = (currentStep, nextStep) => {
    if (currentStep === 1) {
      if (!hasSelectedCategory) {
        setReviewWizardStatus("Debes seleccionar el rubro antes de continuar.")
        return
      }
    }

    if (currentStep === 2) {
      if (!locationSearch.selected) {
        setReviewWizardStatus("Debes seleccionar un establecimiento para continuar.")
        return
      }
      if (!String(locationSearch.selected?.name || "").trim()) {
        setReviewWizardStatus("Debes ingresar el nombre del establecimiento antes de continuar.")
        return
      }
      if (!hasConfirmedEstablishment) {
        setReviewWizardStatus("Debes confirmar y guardar el establecimiento seleccionado antes de continuar.")
        return
      }
    }

    if (currentStep === 3) {
      if (!String(reviewForm.title || "").trim()) {
        setReviewWizardStatus("Debes ingresar el título de la reseña antes de continuar.")
        return
      }
      if (reviewTitleWordCount > MAX_REVIEW_TITLE_WORDS) {
        setReviewWizardStatus(`El título debe tener máximo ${MAX_REVIEW_TITLE_WORDS} palabras.`)
        return
      }
    }

    setReviewWizardStatus("")
    setReviewWizardStep(nextStep)
  }

  const createClientIdempotencyKey = () => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID()
    }
    return `review-${Date.now()}-${Math.random().toString(16).slice(2)}`
  }

  const ensureSufficientAnchorFunds = async ({ provider, address, establishmentId }) => {
    if (!provider || !address || !establishmentId) {
      throw new Error("Missing wallet context for transaction pre-check.")
    }
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider)
    const preflightReviewHash = ethers.solidityPackedKeccak256(
      ["string"],
      [`preflight-${Date.now()}`]
    )
    const establishmentHash = ethers.solidityPackedKeccak256(
      ["string"],
      [String(establishmentId)]
    )
    const gasEstimate = await contract.anchorReview.estimateGas(
      address,
      preflightReviewHash,
      establishmentHash
    )
    const feeData = await provider.getFeeData()
    const gasPrice = feeData?.maxFeePerGas ?? feeData?.gasPrice
    if (!gasPrice || gasPrice <= 0n) {
      throw new Error("No se pudo estimar el fee de red. Intenta de nuevo.")
    }

    // Include a 20% buffer for fee volatility between estimation and submission.
    const requiredWei = (gasEstimate * gasPrice * 120n) / 100n
    const balanceWei = await provider.getBalance(address)
    if (balanceWei < requiredWei) {
      const currentBalance = Number(ethers.formatEther(balanceWei)).toFixed(6)
      const requiredBalance = Number(ethers.formatEther(requiredWei)).toFixed(6)
      throw new Error(
        `Fondos insuficientes en tSYS para gas. Balance: ${currentBalance} tSYS, requerido aprox: ${requiredBalance} tSYS.`
      )
    }
  }

  const getTagColor = (tag) => {
    const seed = String(tag || "")
      .split("")
      .reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
    return TAG_COLORS[seed % TAG_COLORS.length]
  }

  const getDefaultAvatarUrl = (seedBase) => {
    if (pointsConfig.default_user_avatar_url) return pointsConfig.default_user_avatar_url
    const seed = String(seedBase || "syspoints-user")
    return `https://api.dicebear.com/8.x/adventurer/svg?seed=${encodeURIComponent(seed)}`
  }

  const prepareEstablishmentImage = async (file) => {
    const allowedMime = ["image/jpeg", "image/png", "image/webp"]
    if (!allowedMime.includes(file.type)) {
      throw new Error("Formato inválido. Usa JPG, PNG o WEBP.")
    }
    if (file.size > MAX_ESTABLISHMENT_IMAGE_INPUT_BYTES) {
      throw new Error("La imagen excede el tamaño máximo permitido (2MB).")
    }

    const objectUrl = URL.createObjectURL(file)
    try {
      const img = await new Promise((resolve, reject) => {
        const image = new Image()
        image.onload = () => resolve(image)
        image.onerror = () => reject(new Error("No se pudo leer la imagen seleccionada."))
        image.src = objectUrl
      })

      const scale = Math.min(1, ESTABLISHMENT_IMAGE_MAX_DIMENSION / Math.max(img.width, img.height))
      const width = Math.max(1, Math.round(img.width * scale))
      const height = Math.max(1, Math.round(img.height * scale))

      const canvas = document.createElement("canvas")
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("No se pudo procesar la imagen.")
      ctx.drawImage(img, 0, 0, width, height)

      const outputMime = file.type === "image/png" ? "image/png" : "image/jpeg"
      const dataUrl = canvas.toDataURL(outputMime, 0.86)
      return {
        dataUrl,
        mimeType: outputMime,
        fileName: file.name || "establishment",
      }
    } finally {
      URL.revokeObjectURL(objectUrl)
    }
  }

  const prepareWalletLogoImage = async (file) => {
    const allowedMime = ["image/jpeg", "image/png", "image/webp"]
    if (!allowedMime.includes(file.type)) {
      throw new Error("Formato inválido para logo. Usa JPG, PNG o WEBP.")
    }
    if (file.size > MAX_WALLET_LOGO_INPUT_BYTES) {
      throw new Error("El logo excede el tamaño máximo permitido (1MB).")
    }

    const objectUrl = URL.createObjectURL(file)
    try {
      const img = await new Promise((resolve, reject) => {
        const image = new Image()
        image.onload = () => resolve(image)
        image.onerror = () => reject(new Error("No se pudo leer el logo seleccionado."))
        image.src = objectUrl
      })

      const canvas = document.createElement("canvas")
      canvas.width = WALLET_LOGO_STANDARD_SIZE
      canvas.height = WALLET_LOGO_STANDARD_SIZE
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("No se pudo procesar el logo.")

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const scale = Math.min(canvas.width / img.width, canvas.height / img.height)
      const targetWidth = Math.max(1, Math.round(img.width * scale))
      const targetHeight = Math.max(1, Math.round(img.height * scale))
      const offsetX = Math.round((canvas.width - targetWidth) / 2)
      const offsetY = Math.round((canvas.height - targetHeight) / 2)
      ctx.drawImage(img, offsetX, offsetY, targetWidth, targetHeight)

      const outputMime = "image/png"
      const dataUrl = canvas.toDataURL(outputMime, 0.92)
      return {
        dataUrl,
        mimeType: outputMime,
        fileName: file.name || "wallet-logo",
      }
    } finally {
      URL.revokeObjectURL(objectUrl)
    }
  }

  const uploadEstablishmentImage = async (file) => {
    if (!isAdmin) return

    setUploadingEstablishmentImage(true)
    setAdminStatus("")
    try {
      const prepared = await prepareEstablishmentImage(file)
      const uploaded = await apiFetch("/establishments/upload-image", {
        method: "POST",
        body: JSON.stringify({
          file_name: prepared.fileName,
          mime_type: prepared.mimeType,
          data_url: prepared.dataUrl,
        }),
      })
      setNewEstablishment((prev) => ({ ...prev, image_url: uploaded.image_url || "" }))
      setAdminStatus("Imagen subida correctamente.")
    } catch (error) {
      setAdminStatus(error?.message || "No se pudo subir la imagen.")
    } finally {
      setUploadingEstablishmentImage(false)
    }
  }

  const uploadProfileAvatar = async (file) => {
    if (!token) {
      setProfileStatus("Conecta tu wallet e inicia sesión.")
      return
    }

    setUploadingAvatar(true)
    setProfileStatus("")
    try {
      const prepared = await prepareEstablishmentImage(file)
      const uploaded = await apiFetch("/users/me/avatar", {
        method: "POST",
        body: JSON.stringify({
          file_name: prepared.fileName,
          mime_type: prepared.mimeType,
          data_url: prepared.dataUrl,
        }),
      })

      if (!uploaded?.avatar_url) {
        throw new Error("No se recibió una URL de avatar válida.")
      }

      setProfile((prev) => ({ ...prev, avatar_url: uploaded.avatar_url }))
      setProfileStatus("Avatar subido correctamente. No olvides guardar cambios.")
    } catch (error) {
      setProfileStatus(error?.message || "No se pudo subir el avatar.")
    } finally {
      setUploadingAvatar(false)
    }
  }

  const prepareReviewEvidenceImage = async (file) => {
    const allowedMime = ["image/jpeg", "image/png", "image/webp"]
    if (!allowedMime.includes(file.type)) {
      throw new Error("Formato inválido. Usa JPG, PNG o WEBP.")
    }
    if (file.size > MAX_ESTABLISHMENT_IMAGE_INPUT_BYTES) {
      throw new Error("La imagen excede el tamaño máximo permitido (2MB).")
    }

    const objectUrl = URL.createObjectURL(file)
    try {
      const img = await new Promise((resolve, reject) => {
        const image = new Image()
        image.onload = () => resolve(image)
        image.onerror = () => reject(new Error("No se pudo leer la imagen seleccionada."))
        image.src = objectUrl
      })

      const scale = Math.min(1, ESTABLISHMENT_IMAGE_MAX_DIMENSION / Math.max(img.width, img.height))
      const width = Math.max(1, Math.round(img.width * scale))
      const height = Math.max(1, Math.round(img.height * scale))

      const canvas = document.createElement("canvas")
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("No se pudo procesar la imagen.")
      ctx.drawImage(img, 0, 0, width, height)

      const outputMime = file.type === "image/png" ? "image/png" : "image/jpeg"
      const dataUrl = canvas.toDataURL(outputMime, 0.86)
      return {
        dataUrl,
        mimeType: outputMime,
        fileName: file.name || "review-evidence",
      }
    } finally {
      URL.revokeObjectURL(objectUrl)
    }
  }

  const uploadReviewEvidenceImage = async (file) => {
    if (!token) {
      setAuthStatus("Inicia sesión con tu wallet antes de subir evidencias.")
      return
    }

    if (reviewForm.evidence_images.length >= MAX_REVIEW_EVIDENCE_IMAGES) {
      setAuthStatus(`You can upload up to ${MAX_REVIEW_EVIDENCE_IMAGES} evidence images.`)
      return
    }

    setUploadingReviewEvidence(true)
    setAuthStatus("")
    try {
      const prepared = await prepareReviewEvidenceImage(file)
      const uploaded = await apiFetch("/reviews/upload-evidence", {
        method: "POST",
        body: JSON.stringify({
          file_name: prepared.fileName,
          mime_type: prepared.mimeType,
          data_url: prepared.dataUrl,
        }),
      })

      if (!uploaded?.image_url) {
        throw new Error("Invalid evidence upload response.")
      }

      setReviewForm((prev) => ({
        ...prev,
        evidence_images: [...prev.evidence_images, uploaded.image_url].slice(0, MAX_REVIEW_EVIDENCE_IMAGES),
      }))
    } catch (error) {
      const message = String(error?.message || "")
      const isAuthError = /invalid token|missing bearer token|unauthorized|401/i.test(message)
      if (isAuthError) {
        setAuthFlowState("expired")
      }
      setAuthStatus(
        isAuthError
          ? "Tu sesión expiró o no es válida. Conecta tu wallet e inicia sesión nuevamente."
          : (error?.message || "No se pudo subir la evidencia.")
      )
    } finally {
      setUploadingReviewEvidence(false)
    }
  }

  const removeReviewEvidenceImage = (indexToRemove) => {
    setReviewForm((prev) => ({
      ...prev,
      evidence_images: prev.evidence_images.filter((_, index) => index !== indexToRemove),
    }))
  }

  const uploadEditingEstablishmentImage = async (file) => {
    if (!isAdmin || !editingEstablishmentId) return

    setUploadingEstablishmentImage(true)
    setAdminStatus("")
    try {
      const prepared = await prepareEstablishmentImage(file)
      const uploaded = await apiFetch("/establishments/upload-image", {
        method: "POST",
        body: JSON.stringify({
          file_name: prepared.fileName,
          mime_type: prepared.mimeType,
          data_url: prepared.dataUrl,
        }),
      })
      setEditingEstablishment((prev) => ({ ...prev, image_url: uploaded.image_url || "" }))
      setAdminStatus("Imagen subida correctamente.")
    } catch (error) {
      setAdminStatus(error?.message || "No se pudo subir la imagen.")
    } finally {
      setUploadingEstablishmentImage(false)
    }
  }

  const uploadSelectedEstablishmentImage = async (file) => {
    if (!token) {
      setLocationSearch((prev) => ({ ...prev, error: "Inicia sesión para subir imagen del establecimiento." }))
      return
    }
    if (!locationSearch.selected) {
      setLocationSearch((prev) => ({ ...prev, error: "Selecciona un establecimiento primero." }))
      return
    }

    setUploadingSelectedEstablishmentImage(true)
    setLocationSearch((prev) => ({ ...prev, error: "" }))
    try {
      const prepared = await prepareEstablishmentImage(file)
      const uploaded = await apiFetch("/establishments/upload-image", {
        method: "POST",
        body: JSON.stringify({
          file_name: prepared.fileName,
          mime_type: prepared.mimeType,
          data_url: prepared.dataUrl,
        }),
      })

      const uploadedUrl = String(uploaded?.image_url || "").trim()
      if (!uploadedUrl) {
        throw new Error("No se recibió URL de imagen.")
      }

      setImageSuggestions((prev) => ({
        ...prev,
        items: [uploadedUrl, ...prev.items.filter((url) => url !== uploadedUrl)],
        selected: uploadedUrl,
        error: "",
      }))
      setImageSourceMode("upload")
      setLocationSearch((prev) => ({
        ...prev,
        selected: prev.selected
          ? { ...prev.selected, image_url: uploadedUrl }
          : prev.selected,
      }))
    } catch (error) {
      setLocationSearch((prev) => ({ ...prev, error: error?.message || "No se pudo subir imagen." }))
    } finally {
      setUploadingSelectedEstablishmentImage(false)
    }
  }

  const saveProfile = async () => {
    if (!token) {
      setProfileStatus("Conecta tu wallet e inicia sesión.")
      return
    }

    if (!profile.name || !profile.avatar_url) {
      setProfileStatus("Name and avatar URL are required.")
      return
    }

    setProfileBusy(true)
    setProfileStatus("")
    try {
      const updatedUser = await apiFetch("/users/me", {
        method: "PUT",
        body: JSON.stringify({
          name: profile.name,
          email: profile.email || null,
          avatar_url: profile.avatar_url,
        }),
      })
      hydrateProfileFromUser(updatedUser)
      setProfileStatus("Perfil actualizado correctamente.")
    } catch (error) {
      setProfileStatus(error?.message || "No se pudo actualizar el perfil.")
    } finally {
      setProfileBusy(false)
    }
  }

  const fetchAdminUsers = async () => {
    if (!isAdmin) return
    setLoadingAdminUsers(true)
    setAdminStatus("")
    try {
      const users = await apiFetch("/users")
      setAdminUsers(users || [])
    } catch (error) {
      setAdminStatus(error?.message || "No se pudo cargar la lista de usuarios.")
    } finally {
      setLoadingAdminUsers(false)
    }
  }

  const fetchPointsConfig = async () => {
    if (!isAdmin) return
    setLoadingPointsConfig(true)
    setAdminStatus("")
    try {
      const config = await apiFetch("/admin/points-config")
      if (config) {
        setPointsConfig({
          image_points_yes: Number(config.image_points_yes ?? 0),
          image_points_no: Number(config.image_points_no ?? 0),
          description_points_gt_200: Number(config.description_points_gt_200 ?? 0),
          description_points_lte_200: Number(config.description_points_lte_200 ?? 0),
          stars_points_yes: Number(config.stars_points_yes ?? 0),
          stars_points_no: Number(config.stars_points_no ?? 0),
          price_points_lt_100: Number(config.price_points_lt_100 ?? 0),
          price_points_gte_100: Number(config.price_points_gte_100 ?? 0),
          default_user_avatar_url: config.default_user_avatar_url || "",
          metamask_wallet_logo_url: config.metamask_wallet_logo_url || "",
          pali_wallet_logo_url: config.pali_wallet_logo_url || "",
          other_wallet_logo_url: config.other_wallet_logo_url || "",
        })
      }
    } catch (error) {
      setAdminStatus(error?.message || "No se pudo cargar la configuración de puntos.")
    } finally {
      setLoadingPointsConfig(false)
    }
  }

  const fetchPublicWalletBranding = async () => {
    try {
      const config = await apiFetch("/config/points-config")
      if (!config) return
      setPointsConfig((prev) => ({
        ...prev,
        default_user_avatar_url: config.default_user_avatar_url || prev.default_user_avatar_url || "",
        metamask_wallet_logo_url: config.metamask_wallet_logo_url || prev.metamask_wallet_logo_url || "",
        pali_wallet_logo_url: config.pali_wallet_logo_url || prev.pali_wallet_logo_url || "",
        other_wallet_logo_url: config.other_wallet_logo_url || prev.other_wallet_logo_url || "",
      }))
    } catch {
      // Keep defaults if public config endpoint is unavailable.
    }
  }

  const createAdminEstablishment = async () => {
    if (!isAdmin) return
    if (!newEstablishment.name || !newEstablishment.category) {
      setAdminStatus("Name y category son requeridos.")
      return
    }

    setAdminStatus("")
    try {
      await apiFetch("/establishments", {
        method: "POST",
        body: JSON.stringify({
          name: newEstablishment.name,
          category: newEstablishment.category,
          image_url: newEstablishment.image_url || null,
          address: newEstablishment.address || null,
          country: newEstablishment.country || null,
          state_region: newEstablishment.state_region || null,
          district: newEstablishment.district || null,
          latitude: newEstablishment.latitude ? Number(newEstablishment.latitude) : null,
          longitude: newEstablishment.longitude ? Number(newEstablishment.longitude) : null,
        }),
      })
      setNewEstablishment({
        name: "",
        category: "",
        image_url: "",
        address: "",
        country: "",
        state_region: "",
        district: "",
        latitude: "",
        longitude: "",
      })
      setAdminStatus("Establishment creado correctamente.")
      fetchEstablishments()
    } catch (error) {
      setAdminStatus(error?.message || "No se pudo crear el establishment.")
    }
  }

  const startEditingEstablishment = (establishment) => {
    setEditingEstablishmentId(establishment.id)
    setEditingEstablishment({
      name: establishment.name || "",
      category: establishment.category || "",
      image_url: establishment.image_url || "",
      address: establishment.address || "",
      country: establishment.country || "",
      state_region: establishment.state_region || "",
      district: establishment.district || "",
      latitude: establishment.latitude ?? "",
      longitude: establishment.longitude ?? "",
    })
    setAdminStatus("")
  }

  const cancelEditingEstablishment = () => {
    setEditingEstablishmentId("")
    setEditingEstablishment({
      name: "",
      category: "",
      image_url: "",
      address: "",
      country: "",
      state_region: "",
      district: "",
      latitude: "",
      longitude: "",
    })
  }

  const saveEstablishmentEdition = async () => {
    if (!isAdmin || !editingEstablishmentId) return
    if (!editingEstablishment.name || !editingEstablishment.category) {
      setAdminStatus("Name y category son requeridos para editar.")
      return
    }

    setSavingEstablishmentEdition(true)
    setAdminStatus("")
    try {
      const updated = await apiFetch(`/establishments/${editingEstablishmentId}`, {
        method: "PUT",
        body: JSON.stringify({
          name: editingEstablishment.name,
          category: editingEstablishment.category,
          image_url: editingEstablishment.image_url || null,
          address: editingEstablishment.address || null,
          country: editingEstablishment.country || null,
          state_region: editingEstablishment.state_region || null,
          district: editingEstablishment.district || null,
          latitude: editingEstablishment.latitude ? Number(editingEstablishment.latitude) : null,
          longitude: editingEstablishment.longitude ? Number(editingEstablishment.longitude) : null,
        }),
      })
      if (!updated?.id) {
        throw new Error("No se recibió el establishment actualizado.")
      }
      setEstablishments((prev) =>
        prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item))
      )
      setAdminStatus("Establishment actualizado correctamente.")
      cancelEditingEstablishment()
    } catch (error) {
      setAdminStatus(error?.message || "No se pudo actualizar el establishment.")
    } finally {
      setSavingEstablishmentEdition(false)
    }
  }

  const updateAdminPointsConfig = async () => {
    if (!isAdmin) return
    setAdminStatus("")
    try {
      const payload = {
        image_points_yes: Number(pointsConfig.image_points_yes),
        image_points_no: Number(pointsConfig.image_points_no),
        description_points_gt_200: Number(pointsConfig.description_points_gt_200),
        description_points_lte_200: Number(pointsConfig.description_points_lte_200),
        stars_points_yes: Number(pointsConfig.stars_points_yes),
        stars_points_no: Number(pointsConfig.stars_points_no),
        price_points_lt_100: Number(pointsConfig.price_points_lt_100),
        price_points_gte_100: Number(pointsConfig.price_points_gte_100),
        default_user_avatar_url: pointsConfig.default_user_avatar_url || null,
        metamask_wallet_logo_url: pointsConfig.metamask_wallet_logo_url || null,
        pali_wallet_logo_url: pointsConfig.pali_wallet_logo_url || null,
        other_wallet_logo_url: pointsConfig.other_wallet_logo_url || null,
      }

      const updated = await apiFetch("/admin/points-config", {
        method: "PUT",
        body: JSON.stringify(payload),
      })
      setPointsConfig({
        image_points_yes: Number(updated.image_points_yes ?? 0),
        image_points_no: Number(updated.image_points_no ?? 0),
        description_points_gt_200: Number(updated.description_points_gt_200 ?? 0),
        description_points_lte_200: Number(updated.description_points_lte_200 ?? 0),
        stars_points_yes: Number(updated.stars_points_yes ?? 0),
        stars_points_no: Number(updated.stars_points_no ?? 0),
        price_points_lt_100: Number(updated.price_points_lt_100 ?? 0),
        price_points_gte_100: Number(updated.price_points_gte_100 ?? 0),
        default_user_avatar_url: updated.default_user_avatar_url || "",
        metamask_wallet_logo_url: updated.metamask_wallet_logo_url || "",
        pali_wallet_logo_url: updated.pali_wallet_logo_url || "",
        other_wallet_logo_url: updated.other_wallet_logo_url || "",
      })
      setAdminStatus("Configuración de puntos actualizada.")
    } catch (error) {
      setAdminStatus(error?.message || "No se pudo actualizar la configuración de puntos.")
    }
  }

  const uploadDefaultUserAvatar = async (file) => {
    if (!isAdmin) return
    setUploadingDefaultAvatar(true)
    setAdminStatus("")
    try {
      const prepared = await prepareEstablishmentImage(file)
      const uploaded = await apiFetch("/admin/points-config/default-avatar", {
        method: "POST",
        body: JSON.stringify({
          file_name: prepared.fileName,
          mime_type: prepared.mimeType,
          data_url: prepared.dataUrl,
        }),
      })
      setPointsConfig((prev) => ({
        ...prev,
        default_user_avatar_url: uploaded.default_user_avatar_url || "",
      }))
      setAdminStatus("Avatar por defecto subido correctamente.")
    } catch (error) {
      setAdminStatus(error?.message || "No se pudo subir el avatar por defecto.")
    } finally {
      setUploadingDefaultAvatar(false)
    }
  }

  const uploadWalletLogo = async (walletKey, file) => {
    if (!isAdmin) return
    if (!walletKey || !file) return

    setUploadingWalletLogoKey(walletKey)
    setAdminStatus("")
    try {
      const prepared = await prepareWalletLogoImage(file)
      const uploaded = await apiFetch("/admin/points-config/wallet-logo", {
        method: "POST",
        body: JSON.stringify({
          wallet_key: walletKey,
          file_name: prepared.fileName,
          mime_type: prepared.mimeType,
          data_url: prepared.dataUrl,
        }),
      })

      setPointsConfig((prev) => ({
        ...prev,
        metamask_wallet_logo_url: uploaded.metamask_wallet_logo_url || prev.metamask_wallet_logo_url || "",
        pali_wallet_logo_url: uploaded.pali_wallet_logo_url || prev.pali_wallet_logo_url || "",
        other_wallet_logo_url: uploaded.other_wallet_logo_url || prev.other_wallet_logo_url || "",
      }))
      setAdminStatus("Logo de wallet actualizado correctamente.")
    } catch (error) {
      setAdminStatus(error?.message || "No se pudo subir el logo de wallet.")
    } finally {
      setUploadingWalletLogoKey("")
    }
  }

  const fetchReviews = async (page = 1) => {
    setLoadingReviews(true)
    try {
      const result = await apiFetch(`/reviews?page=${page}&page_size=${DEFAULT_PAGE_SIZE}`)
      setReviews(result.data || [])
      setReviewsMeta(result.meta || { page, page_size: DEFAULT_PAGE_SIZE, total: 0 })
    } catch {
      setReviews([])
    } finally {
      setLoadingReviews(false)
    }
  }

  const fetchLeaderboard = async (page = 1) => {
    setLoadingLeaderboard(true)
    try {
      const result = await apiFetch(`/leaderboard?page=${page}&page_size=5`)
      setLeaderboard(result.data || [])
      setLeaderMeta(result.meta || { page, page_size: 5, total: 0 })
    } catch {
      setLeaderboard([])
    } finally {
      setLoadingLeaderboard(false)
    }
  }

  const fetchTopEstablishments = async (page = 1) => {
    setLoadingTopEstablishments(true)
    try {
      const result = await apiFetch(`/establishments/top-reviewed?page=${page}&page_size=5`)
      setTopEstablishments(result.data || [])
    } catch {
      setTopEstablishments([])
    } finally {
      setLoadingTopEstablishments(false)
    }
  }

  const fetchEstablishments = async () => {
    try {
      const result = await apiFetch("/establishments")
      setEstablishments(result || [])
    } catch {
      setEstablishments([])
    }
  }

  const fetchReviewCaptchaChallenge = async () => {
    if (!token) {
      setReviewCaptcha({
        loading: false,
        requiresCaptcha: false,
        challenge: "",
        token: "",
        expiresAt: "",
        answer: "",
        error: "",
      })
      return
    }

    setReviewCaptcha((prev) => ({ ...prev, loading: true, error: "" }))
    try {
      const response = await apiFetch("/reviews/captcha-challenge")
      setReviewCaptcha({
        loading: false,
        requiresCaptcha: Boolean(response?.requires_captcha),
        challenge: String(response?.challenge || ""),
        token: String(response?.captcha_token || ""),
        expiresAt: String(response?.captcha_expires_at || ""),
        answer: "",
        error: "",
      })
    } catch (error) {
      setReviewCaptcha({
        loading: false,
        requiresCaptcha: false,
        challenge: "",
        token: "",
        expiresAt: "",
        answer: "",
        error: error?.message || "No se pudo cargar el captcha.",
      })
    }
  }

  const searchLocationsByAddress = async () => {
    const query = locationSearch.query.trim()
    if (!query) {
      setLocationSearch((prev) => ({
        ...prev,
        error: "Ingresa una dirección para buscar.",
        results: [],
      }))
      return
    }

    setLocationSearch((prev) => ({ ...prev, loading: true, error: "", results: [] }))
    try {
      const response = await apiFetch("/establishments/search-location", {
        method: "POST",
        body: JSON.stringify({
          query: [establishmentCategory, query].filter(Boolean).join(" "),
          limit: MAP_SEARCH_RESULT_LIMIT,
        }),
      })
      const normalized = Array.isArray(response?.data)
        ? response.data
            .slice(0, MAP_SEARCH_RESULT_LIMIT)
            .map((item) => {
              const lat = toNumberOrNull(item?.latitude)
              const lon = toNumberOrNull(item?.longitude)
              if (lat == null || lon == null) return null
              const suggestedImages = Array.isArray(item?.suggested_images)
                ? item.suggested_images.filter((url) => /^https?:\/\//i.test(String(url || "")))
                : []
              return {
                id: String(item?.id || `${lat}-${lon}`),
                name: String(item?.name || "Establishment").trim(),
                address: String(item?.address || "").trim(),
                country: String(item?.country || "").trim(),
                state_region: String(item?.state_region || "").trim(),
                district: String(item?.district || "").trim(),
                latitude: lat,
                longitude: lon,
                category: String(establishmentCategory || "Services"),
                image_url: String(suggestedImages[0] || "").trim(),
                suggested_images: suggestedImages,
                source: "search",
              }
            })
            .filter(Boolean)
        : []

      setLocationSearch((prev) => ({
        ...prev,
        loading: false,
        results: normalized,
        mapCenter: normalized[0]
          ? { latitude: normalized[0].latitude, longitude: normalized[0].longitude }
          : prev.mapCenter,
        error: normalized.length ? "" : "No encontramos resultados para esa dirección.",
      }))
    } catch (error) {
      setLocationSearch((prev) => ({
        ...prev,
        loading: false,
        error: error?.message || "No se pudo consultar el mapa.",
      }))
    }
  }

  const loadEstablishmentImageSuggestions = async (candidate) => {
    if (!candidate) return

    setImageSuggestions({ loading: true, error: "", items: [], selected: "" })
    const localPlaceholder = buildLocalPlaceholderImage({ title: candidate.name })
    const existingDbImages = [...new Set(
      establishments
        .map((item) => String(item?.image_url || "").trim())
        .filter((url) => /^https?:\/\//i.test(url))
    )]

    try {
      const query = [candidate.category || establishmentCategory, candidate.name, candidate.address].filter(Boolean).join(" ").trim()
      const response = await apiFetch("/establishments/suggest-images", {
        method: "POST",
        body: JSON.stringify({
          query,
          category: candidate.category || establishmentCategory || "Map Place",
        }),
      })
      const items = Array.isArray(response?.data)
        ? response.data
            .map((item) => String(item?.image_url || "").trim())
            .filter((url) => /^https?:\/\//i.test(url))
            .slice(0, 40)
        : []

      const normalizedItems = [...new Set([...existingDbImages, ...items, localPlaceholder].filter(Boolean))]
      setImageSuggestions({
        loading: false,
        error: normalizedItems.length ? "" : "No se pudieron cargar imágenes sugeridas.",
        items: normalizedItems,
        selected: normalizedItems[0] || "",
      })
    } catch (error) {
      const fallbackItems = [...new Set([...existingDbImages, localPlaceholder].filter(Boolean))]
      setImageSuggestions({
        loading: false,
        error: fallbackItems.length ? "" : (error?.message || "No se pudieron cargar imágenes sugeridas."),
        items: fallbackItems,
        selected: fallbackItems[0] || "",
      })
    }
  }

  const pickLocationCandidate = async (candidate) => {
    if (!candidate) return
    const normalizedCandidate = {
      ...candidate,
      category: candidate.category || establishmentCategory || "Map Place",
      source: candidate.source || "search",
    }
    setReviewForm((prev) => ({ ...prev, establishment_id: "" }))
    setLocationSearch((prev) => ({
      ...prev,
      selected: normalizedCandidate,
      resolvedId: "",
      mapCenter: { latitude: normalizedCandidate.latitude, longitude: normalizedCandidate.longitude },
      error: "",
    }))
    await loadEstablishmentImageSuggestions(normalizedCandidate)
  }

  const locateCurrentPosition = async () => {
    if (!navigator?.geolocation) {
      setLocationSearch((prev) => ({ ...prev, error: "Tu navegador no soporta geolocalización." }))
      return
    }

    setLocationSearch((prev) => ({ ...prev, geolocating: true, error: "" }))
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 0,
        })
      })

      const latitude = toNumberOrNull(position?.coords?.latitude)
      const longitude = toNumberOrNull(position?.coords?.longitude)
      if (latitude == null || longitude == null) {
        throw new Error("No se pudo leer tu ubicación actual.")
      }

      const params = new URLSearchParams({
        format: "jsonv2",
        lat: String(latitude),
        lon: String(longitude),
        addressdetails: "1",
      })
      const response = await fetch(`${NOMINATIM_REVERSE_URL}?${params.toString()}`, {
        headers: { "Accept-Language": "es,en" },
      })
      if (!response.ok) {
        throw new Error("No se pudo resolver la dirección desde OSM.")
      }
      const data = await response.json()
      const addr = data?.address || {}
      const normalized = [{
        id: String(data?.place_id || `gps-${latitude}-${longitude}`),
        name: String(
          data?.name ||
            addr?.amenity ||
            addr?.shop ||
            addr?.building ||
            data?.display_name?.split(",")?.[0] ||
            "Establishment"
        ).trim(),
        address: String(data?.display_name || "").trim() || `Lat ${latitude}, Lng ${longitude}`,
        country: String(addr?.country || "").trim(),
        state_region: String(addr?.state || addr?.region || addr?.county || "").trim(),
        district: String(addr?.city_district || addr?.suburb || addr?.city || addr?.town || "").trim(),
        latitude,
        longitude,
        category: String(establishmentCategory || "Services"),
        image_url: "",
        suggested_images: [],
        source: "geolocation",
      }]

      setLocationSearch((prev) => ({
        ...prev,
        results: normalized,
        selected: normalized[0] || null,
        resolvedId: "",
        geolocating: false,
        mapCenter: normalized[0]
          ? { latitude: normalized[0].latitude, longitude: normalized[0].longitude }
          : prev.mapCenter,
        error: normalized.length ? "" : "No encontramos resultados cercanos.",
      }))

      if (normalized[0]) {
        await loadEstablishmentImageSuggestions(normalized[0])
      }
    } catch (error) {
      setLocationSearch((prev) => ({
        ...prev,
        geolocating: false,
        error: error?.message || "No se pudo ubicar tu posición actual.",
      }))
    }
  }

  const resolveAndSelectEstablishment = async () => {
    const candidate = locationSearch.selected
    if (!candidate) return

    setLocationSearch((prev) => ({ ...prev, resolving: true, error: "" }))
    try {
      const resolved = await apiFetch("/establishments/resolve", {
        method: "POST",
        body: JSON.stringify({
          name: candidate.name,
          address: candidate.address,
          country: candidate.country || null,
          state_region: candidate.state_region || null,
          district: candidate.district || null,
          latitude: candidate.latitude,
          longitude: candidate.longitude,
          category: candidate.category || establishmentCategory || "Map Place",
          image_url: imageSuggestions.selected || candidate.image_url || null,
        }),
      })

      setReviewForm((prev) => ({
        ...prev,
        establishment_id: resolved.id,
      }))
      setLocationSearch((prev) => ({
        ...prev,
        loading: false,
        selected: {
          id: resolved.id,
          name: resolved.name || candidate.name,
          address: resolved.address || candidate.address,
          country: resolved.country || candidate.country || "",
          state_region: resolved.state_region || candidate.state_region || "",
          district: resolved.district || candidate.district || "",
          latitude: toNumberOrNull(resolved.latitude) ?? candidate.latitude,
          longitude: toNumberOrNull(resolved.longitude) ?? candidate.longitude,
          image_url: resolved.image_url || imageSuggestions.selected || candidate.image_url || "",
          category: resolved.category || candidate.category,
          source: candidate.source || "search",
        },
        resolving: false,
        resolvedId: candidate.id,
        error: "",
      }))
      setEstablishments((prev) => {
        const exists = prev.some((item) => item.id === resolved.id)
        if (exists) {
          return prev.map((item) => (item.id === resolved.id ? { ...item, ...resolved } : item))
        }
        return [resolved, ...prev]
      })
      setReviewWizardStep(3)
    } catch (error) {
      setLocationSearch((prev) => ({
        ...prev,
        resolving: false,
        error: error?.message || "No se pudo seleccionar este establecimiento.",
      }))
    }
  }

  const loadReviewDetail = async (reviewId) => {
    setLoadingSelectedReview(true)
    setLoadingReviewId(reviewId)
    setReviewChainInfo({
      loading: false,
      anchored: false,
      txHash: "",
      blockNumber: null,
      blockTimestamp: null,
      unavailable: "",
      error: "",
    })
    try {
      const review = await apiFetch(`/reviews/${reviewId}`)
      setSelectedReview(review)
      const hasStoredTxHash = Boolean(review?.tx_hash)
      const blockTimestampMs = review?.block_timestamp ? new Date(review.block_timestamp).getTime() : null
      setReviewChainInfo({
        loading: false,
        anchored: hasStoredTxHash,
        txHash: review?.tx_hash || "",
        blockNumber: review?.block_number ?? null,
        blockTimestamp: Number.isFinite(blockTimestampMs) ? blockTimestampMs : null,
        unavailable: "",
        error: "",
      })
      setActivePage("review-detail")
    } catch (error) {
      setAuthStatus(error?.message || "No se pudo cargar el detalle del review.")
    } finally {
      setLoadingSelectedReview(false)
      setLoadingReviewId("")
    }
  }

  const fetchReviewChainProof = async (review) => {
    if (!walletAddress) {
      const hasStoredTxHash = Boolean(review?.tx_hash)
      const blockTimestampMs = review?.block_timestamp ? new Date(review.block_timestamp).getTime() : null
      setReviewChainInfo({
        loading: false,
        anchored: hasStoredTxHash,
        txHash: review?.tx_hash || "",
        blockNumber: review?.block_number ?? null,
        blockTimestamp: Number.isFinite(blockTimestampMs) ? blockTimestampMs : null,
        unavailable: "",
        error: "",
      })
      return
    }

    if (!review?.review_hash) {
      setReviewChainInfo({
        loading: false,
        anchored: false,
        txHash: "",
        blockNumber: null,
        blockTimestamp: null,
        unavailable: "",
        error: "Review hash not available.",
      })
      return
    }

    const providerCandidates = []
    if (readProvider) {
      providerCandidates.push(readProvider)
    }
    const walletProvider = getWalletProvider()
    if (walletProvider) {
      try {
        const walletNetwork = await walletProvider.getNetwork()
        if (Number(walletNetwork.chainId) === Number(CHAIN_ID)) {
          providerCandidates.push(walletProvider)
        }
      } catch {
        // ignore wallet provider if it is not available for EVM requests
      }
    }
    if (providerCandidates.length === 0 || !CONTRACT_ADDRESS) {
      let unavailable = "No hay provider blockchain disponible para verificar este review."
      if (!CONTRACT_ADDRESS) {
        unavailable = "La verificación on-chain no está configurada en este entorno (falta VITE_CONTRACT_ADDRESS)."
      } else if (!readProvider && !walletAddress) {
        unavailable = "Verificación on-chain no disponible en modo lectura. Conecta una wallet EVM en Syscoin Devnet o configura VITE_RPC_URL."
      } else if (!readProvider) {
        unavailable = "No hay RPC de lectura configurado. Define VITE_RPC_URL para consultar la prueba sin depender de la wallet."
      }
      setReviewChainInfo({
        loading: false,
        anchored: false,
        txHash: "",
        blockNumber: null,
        blockTimestamp: null,
        unavailable,
        error: "",
      })
      return
    }

    setReviewChainInfo((prev) => ({ ...prev, loading: true, unavailable: "", error: "" }))
    let lastError = null
    for (const currentProvider of providerCandidates) {
      try {
        const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, currentProvider)
        const filter = contract.filters.ReviewAnchored(null, review.review_hash, null)
        const logs = await contract.queryFilter(filter, 0)
        const latestLog = logs.length > 0 ? logs[logs.length - 1] : null

        if (!latestLog) {
          setReviewChainInfo({
            loading: false,
            anchored: false,
            txHash: "",
            blockNumber: null,
            blockTimestamp: null,
            unavailable: "",
            error: "",
          })
          return
        }

        const block = await currentProvider.getBlock(latestLog.blockNumber)
        setReviewChainInfo({
          loading: false,
          anchored: true,
          txHash: latestLog.transactionHash || "",
          blockNumber: latestLog.blockNumber || null,
          blockTimestamp: block?.timestamp ? Number(block.timestamp) * 1000 : null,
          unavailable: "",
          error: "",
        })
        return
      } catch (error) {
        lastError = error
      }
    }

    if (lastError) {
      const proofError = getChainProofErrorMessage(lastError)
      const readOnlyUnavailable =
        !walletAddress &&
        !hasWalletProvider &&
        /verificación en blockchain no está disponible temporalmente/i.test(proofError)
      setReviewChainInfo({
        loading: false,
        anchored: false,
        txHash: "",
        blockNumber: null,
        blockTimestamp: null,
        unavailable: readOnlyUnavailable
          ? "Verificación on-chain no disponible temporalmente en modo lectura. Conecta una wallet EVM o revisa la configuración RPC (VITE_RPC_URL/CORS)."
          : "",
        error: readOnlyUnavailable ? "" : proofError,
      })
    }
  }

  const submitReview = async () => {
    if (submittingReview || reviewTx.step === "preparing" || reviewTx.step === "signing" || reviewTx.step === "pending") {
      return
    }

    setSubmittingReview(true)
    if (!token) {
      setAuthStatus("Sign in with your wallet before posting a review.")
      setSubmittingReview(false)
      return
    }

    setAuthStatus("")
    try {
      openReviewTxModal({
        step: "preparing",
        message: "Preparing review payload...",
        points: 0,
        txHash: "",
        explorerUrl: "",
      })

      await ensureNetwork()
      if (!userId) {
        setAuthStatus("Missing user id in token. Sign in again.")
        setReviewTx((prev) => ({
          ...prev,
          step: "error",
          message: "Missing user id in token. Sign in again.",
        }))
        return
      }

      if (!reviewForm.establishment_id) {
        setAuthStatus("Select an establishment before submitting your review.")
        setReviewTx((prev) => ({
          ...prev,
          step: "error",
          message: "Select an establishment before submitting your review.",
        }))
        return
      }

      const titleWords = countWords(reviewForm.title)
      if (!reviewForm.title.trim()) {
        setAuthStatus("Title is required.")
        setReviewTx((prev) => ({ ...prev, step: "error", message: "Title is required." }))
        return
      }
      if (titleWords > MAX_REVIEW_TITLE_WORDS) {
        setAuthStatus(`Title must have at most ${MAX_REVIEW_TITLE_WORDS} words.`)
        setReviewTx((prev) => ({
          ...prev,
          step: "error",
          message: `Title must have at most ${MAX_REVIEW_TITLE_WORDS} words.`,
        }))
        return
      }
      if (
        !Array.isArray(reviewForm.evidence_images) ||
        reviewForm.evidence_images.length < MIN_REVIEW_EVIDENCE_IMAGES ||
        reviewForm.evidence_images.length > MAX_REVIEW_EVIDENCE_IMAGES
      ) {
        setAuthStatus(`Evidence images must be between ${MIN_REVIEW_EVIDENCE_IMAGES} and ${MAX_REVIEW_EVIDENCE_IMAGES}.`)
        setReviewTx((prev) => ({
          ...prev,
          step: "error",
          message: `Evidence images must be between ${MIN_REVIEW_EVIDENCE_IMAGES} and ${MAX_REVIEW_EVIDENCE_IMAGES}.`,
        }))
        return
      }

      if (reviewCaptcha.requiresCaptcha) {
        if (!reviewCaptcha.token) {
          setAuthStatus("Captcha no disponible. Recarga el captcha e inténtalo de nuevo.")
          setReviewTx((prev) => ({
            ...prev,
            step: "error",
            message: "Captcha no disponible. Recarga el captcha e inténtalo de nuevo.",
          }))
          return
        }
        if (!String(reviewCaptcha.answer || "").trim()) {
          setAuthStatus("Debes resolver el captcha antes de enviar la reseña.")
          setReviewTx((prev) => ({
            ...prev,
            step: "error",
            message: "Debes resolver el captcha antes de enviar la reseña.",
          }))
          return
        }
      }

      const tags = reviewForm.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)

      const body = {
        user_id: userId,
        establishment_id: reviewForm.establishment_id,
        title: reviewForm.title.trim(),
        description: reviewForm.description,
        stars: Number(reviewForm.stars),
        price: Number(reviewForm.price),
        purchase_url: String(reviewForm.purchase_url || "").trim() || null,
        tags,
        evidence_images: reviewForm.evidence_images,
        captcha_token: reviewCaptcha.requiresCaptcha ? reviewCaptcha.token : null,
        captcha_answer: reviewCaptcha.requiresCaptcha ? String(reviewCaptcha.answer || "").trim() : null,
      }

      const provider = getWalletProvider()
      if (!provider) {
        throw new Error("Wallet provider not found.")
      }
      await ensureSufficientAnchorFunds({
        provider,
        address: walletAddress,
        establishmentId: reviewForm.establishment_id,
      })

      const requestSignature = JSON.stringify(body)
      let idempotencyKey = reviewSubmissionState.key
      if (!idempotencyKey || reviewSubmissionState.signature !== requestSignature) {
        idempotencyKey = createClientIdempotencyKey()
        setReviewSubmissionState({ key: idempotencyKey, signature: requestSignature })
      }

      const created = await apiFetch("/reviews", {
        method: "POST",
        headers: {
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(body),
      })

      const reviewId = created.id
      const pointsAwarded = Number(created?.points_awarded ?? 0)

      // On-chain anchoring (user pays gas)
      if (reviewId) {
        const signer = await provider.getSigner()
        const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer)
        setReviewTx((prev) => ({
          ...prev,
          step: "signing",
          message: "Confirm the transaction in your wallet to anchor this review on-chain.",
        }))

        const reviewHash = String(created?.review_hash || "")
        if (!ethers.isHexString(reviewHash, 32)) {
          throw new Error("Invalid review hash returned by backend.")
        }

        const establishmentHash = ethers.solidityPackedKeccak256(
          ["string"],
          [String(reviewForm.establishment_id)]
        )

        const tx = await contract.anchorReview(walletAddress, reviewHash, establishmentHash)
        const txHash = tx?.hash || ""
        const explorerBase = String(EXPLORER_TX_BASE_URL || "").replace(/\/+$/, "")
        const explorerUrl = txHash && explorerBase ? `${explorerBase}/${txHash}` : ""
        setReviewTx((prev) => ({
          ...prev,
          step: "pending",
          txHash,
          explorerUrl,
          points: pointsAwarded,
          message: "Transaction submitted. Waiting for confirmation...",
        }))

        const receipt = await tx.wait()
        let blockTimestampIso = null
        if (receipt?.blockNumber != null) {
          try {
            const block = await provider.getBlock(receipt.blockNumber)
            if (block?.timestamp) {
              blockTimestampIso = new Date(Number(block.timestamp) * 1000).toISOString()
            }
          } catch {
            blockTimestampIso = null
          }
        }

        try {
          await apiFetch(`/reviews/${reviewId}/anchor-tx`, {
            method: "POST",
            body: JSON.stringify({
              tx_hash: txHash,
              chain_id: Number(CHAIN_ID) || null,
              block_number: receipt?.blockNumber ?? null,
              block_timestamp: blockTimestampIso,
            }),
          })
        } catch {
          // keep UX successful even if metadata persistence fails
        }

        setReviewTx((prev) => ({
          ...prev,
          step: "success",
          txHash,
          explorerUrl,
          points: pointsAwarded,
          message: "Review anchored successfully on-chain.",
        }))
      } else {
        setReviewTx((prev) => ({
          ...prev,
          step: "success",
          points: pointsAwarded,
          message: "Review submitted successfully.",
        }))
      }

      setReviewForm({
        establishment_id: "",
        title: "",
        description: "",
        stars: 0,
        price: "",
        purchase_url: "",
        tags: "",
        evidence_images: [],
      })
      setLocationSearch({
        query: "",
        loading: false,
        error: "",
        results: [],
        selected: null,
        resolvedId: "",
        resolving: false,
        geolocating: false,
        mapCenter: { ...DEFAULT_MAP_VIEW },
      })
      setImageSuggestions({
        loading: false,
        error: "",
        items: [],
        selected: "",
      })
      setImageSourceMode("existing")
      setEstablishmentCategory("")
      setReviewSubmissionState({ key: "", signature: "" })
      setAuthStatus(REVIEW_SUCCESS_MESSAGE)
      fetchReviews(1)
      fetchLeaderboard(leaderMeta.page)
      setActivePage("reviews")
    } catch (error) {
      const message = getWalletErrorMessage(error, "Failed to submit review.")
      if (/invalid captcha|captcha_token and captcha_answer are required/i.test(message)) {
        await fetchReviewCaptchaChallenge()
        setReviewWizardStep(9)
      }
      setAuthStatus(message)
      setReviewTx((prev) => ({
        ...prev,
        step: "error",
        message,
      }))
    } finally {
      setSubmittingReview(false)
    }
  }

  useEffect(() => {
    if (!token) return
    fetchCurrentUser(token)
      .then((user) => hydrateProfileFromUser(user))
      .catch(() => {})
  }, [token])

  useEffect(() => {
    if (activePage !== "profile" || !token) return
    fetchCurrentUser(token)
      .then((user) => {
        hydrateProfileFromUser(user)
        setProfileStatus("")
      })
      .catch((error) => {
        setProfileStatus(error?.message || "No se pudieron cargar tus datos.")
      })
  }, [activePage, token])

  useEffect(() => {
    if (activePage !== "review") return
    if (authStatus === REVIEW_SUCCESS_MESSAGE) {
      setAuthStatus("")
    }
  }, [activePage, authStatus])

  useEffect(() => {
    if (activePage !== "review") return
    fetchReviewCaptchaChallenge()
  }, [activePage, token])

  useEffect(() => {
    if (activePage !== "review") return
    if (!hasSelectedCategory) {
      if (reviewWizardStep !== 1) setReviewWizardStep(1)
      return
    }
    if (!hasConfirmedEstablishment) {
      if (reviewWizardStep > 2) setReviewWizardStep(2)
      return
    }
    if (!hasValidReviewTitle) {
      if (reviewWizardStep > 3) setReviewWizardStep(3)
      return
    }
  }, [
    activePage,
    hasSelectedCategory,
    hasConfirmedEstablishment,
    hasValidReviewTitle,
    reviewWizardStep,
  ])

  useEffect(() => {
    if (activePage !== "review") return
    if (reviewWizardStatus) {
      setReviewWizardStatus("")
    }
  }, [activePage, reviewWizardStep])

  useEffect(() => {
    if (activePage !== "review-detail" || !selectedReview) return
    fetchReviewChainProof(selectedReview)
  }, [activePage, selectedReview, readProvider])

  useEffect(() => {
    if (!isAdmin) return
    if (activePage === "admin-users") {
      fetchAdminUsers()
    }
    if (activePage === "admin-points") {
      fetchPointsConfig()
    }
  }, [activePage, isAdmin])

  return (
    <div className="app-shell">
      <Header
        walletAddress={walletAddress}
        walletProviderLabel={connectedWalletLabel || "Wallet"}
        walletNetworkLabel={walletNetworkLabel}
        walletUserName={walletUserName}
        isConnected={Boolean(walletAddress && token)}
        isAdmin={Boolean(walletAddress && token && isAdmin)}
        hasWalletProvider={hasWalletProvider}
        activePage={activePage}
        onWalletAction={handleWalletAction}
        onNavigate={setActivePage}
      />

      <WalletModal
        isOpen={showWalletModal}
        isVisible={modalVisible}
        walletOptions={walletOptions}
        walletBusy={walletBusy}
        walletSelection={walletSelection}
        authFlowState={authFlowState}
        statusMessage={walletModalStatus}
        providerLabel={detectProvider()}
        onClose={closeWalletModal}
        onConnectWallet={connectWallet}
      />

      {showTxModal && (
        <div className={`modal-overlay ${txModalVisible ? "show" : ""}`} onClick={closeReviewTxModal}>
          <div className={`modal-card ${txModalVisible ? "show" : ""}`} onClick={(event) => event.stopPropagation()}>
            <h3>Transaction status</h3>
            <div className="tx-status">
              <span className={`tx-badge tx-${reviewTx.step || "idle"}`}>
                {(reviewTx.step || "idle").toUpperCase()}
              </span>
              <p>{reviewTx.message || "Waiting..."}</p>
            </div>
            {["pending", "success"].includes(reviewTx.step) && (
              <p className="tx-points">
                Points earned: <strong>+{reviewTx.points}</strong>
              </p>
            )}
            {reviewTx.txHash && (
              <div className="tx-meta">
                <div>
                  Tx Hash:
                  {" "}
                  <code style={{ wordBreak: "break-all" }}>{reviewTx.txHash}</code>
                </div>
                {reviewTx.explorerUrl && (
                  <a href={reviewTx.explorerUrl} target="_blank" rel="noreferrer">
                    View on explorer
                  </a>
                )}
              </div>
            )}
            <button
              className="ghost-button"
              style={{ marginTop: "16px" }}
              onClick={closeReviewTxModal}
              disabled={reviewTx.step === "pending" || reviewTx.step === "signing"}
            >
              {reviewTx.step === "pending" || reviewTx.step === "signing" ? "Waiting confirmation..." : "Close"}
            </button>
          </div>
        </div>
      )}

      <div className="page-wrap">
        {activePage === "reviews" && (
          <>
            <section className="hero">
              <div className="hero-row">
                <span className="hero-line" />
                <div>
                  <h1>Las mejores reseñas del año</h1>
                  <p>
                    Reseñas verificadas y valoraciones de la comunidad Syspoints.
                  </p>
                </div>
              </div>
              {wrongNetwork && (
                <div className="pill" style={{ color: "#f97316" }}>
                  Wrong network — switch to Syscoin Devnet
                </div>
              )}
            </section>

            <div className="grid">
              <section className="panel" style={{ gridColumn: "1 / 2" }}>
                <div className="panel-header">
                  <h3 className="panel-title">Recent reviews</h3>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", gap: "4px" }}>
                      <button
                        className="ghost-button icon-button"
                        style={{ background: reviewsView === "list" ? "var(--surface-alt)" : "transparent" }}
                        onClick={() => setReviewsView("list")}
                        aria-pressed={reviewsView === "list"}
                        aria-label="List view"
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="8" y1="6" x2="21" y2="6"></line>
                          <line x1="8" y1="12" x2="21" y2="12"></line>
                          <line x1="8" y1="18" x2="21" y2="18"></line>
                          <line x1="3" y1="6" x2="3.01" y2="6"></line>
                          <line x1="3" y1="12" x2="3.01" y2="12"></line>
                          <line x1="3" y1="18" x2="3.01" y2="18"></line>
                        </svg>
                      </button>
                      <button
                        className="ghost-button icon-button"
                        style={{ background: reviewsView === "grid" ? "var(--surface-alt)" : "transparent" }}
                        onClick={() => setReviewsView("grid")}
                        aria-pressed={reviewsView === "grid"}
                        aria-label="Grid view"
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="7" height="7"></rect>
                          <rect x="14" y="3" width="7" height="7"></rect>
                          <rect x="14" y="14" width="7" height="7"></rect>
                          <rect x="3" y="14" width="7" height="7"></rect>
                        </svg>
                      </button>
                    </div>
                    <div style={{ display: "flex", gap: "8px", marginLeft: "auto" }}>
                      <button
                        className="ghost-button"
                        disabled={reviewsMeta.page <= 1}
                        onClick={() => fetchReviews(reviewsMeta.page - 1)}
                      >
                        ←
                      </button>
                      <button
                        className="ghost-button"
                        disabled={reviews.length < DEFAULT_PAGE_SIZE}
                        onClick={() => fetchReviews(reviewsMeta.page + 1)}
                      >
                        →
                      </button>
                    </div>
                  </div>
                </div>
                {loadingReviews ? (
                  <p>Loading reviews...</p>
                ) : (
                  <>
                    {reviewsView === "list" ? (
                      <div className="reviews-grid">
                        <div className="table-header">
                          <div>Rank</div>
                          <div>Review</div>
                          <div style={{ textAlign: "right" }}>Rating</div>
                        </div>
                        {reviews.map((review, index) => (
                          <div className="review-card table-row" key={review.id}>
                            <div className="rank-pill">#{(reviewsMeta.page - 1) * DEFAULT_PAGE_SIZE + index + 1}</div>
                            <div>
                              <div className="review-row">
                                <div className="review-thumb review-thumb-lg" style={{ padding: 0, overflow: "hidden" }}>
                                  {establishmentsById.get(review.establishment_id)?.image_url ? (
                                    <img
                                      src={establishmentsById.get(review.establishment_id)?.image_url}
                                      alt={establishmentsById.get(review.establishment_id)?.name || "Establishment"}
                                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                    />
                                  ) : (
                                    <span>{(establishmentsById.get(review.establishment_id)?.name || review.establishment_id || "S")?.[0] || "S"}</span>
                                  )}
                                </div>
                                <div>
                                  <div className="review-title">{review.title || "Untitled review"}</div>
                                  <div className="review-sub">
                                    {truncateWithEllipsis(review.description, HOME_REVIEW_DESCRIPTION_MAX_CHARS)}
                                  </div>
                                  {Array.isArray(review.tags) && review.tags.length > 0 && (
                                    <div className="review-tags" style={{ marginTop: "8px" }}>
                                      {review.tags.map((tag) => {
                                        const tagColor = getTagColor(tag)
                                        return (
                                          <span
                                            key={`${review.id}-${tag}`}
                                            className="tag"
                                            style={{ background: tagColor.background, color: tagColor.color }}
                                          >
                                            #{tag}
                                          </span>
                                        )
                                      })}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="review-actions review-actions-main">
                              <div className="review-stars">
                                {"★".repeat(Number(review.stars) || 0)}
                                {"☆".repeat(5 - (Number(review.stars) || 0))}
                              </div>
                              <button className="primary-button alt watch-button" onClick={() => loadReviewDetail(review.id)} disabled={loadingSelectedReview}>
                                {loadingSelectedReview && loadingReviewId === review.id ? "Loading..." : "See more"}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="reviews-cards">
                        {reviews.map((review, index) => (
                          <div className="review-card card" key={review.id}>
                            <div className="card-image-wrap">
                              {establishmentsById.get(review.establishment_id)?.image_url ? (
                                <img
                                  src={establishmentsById.get(review.establishment_id)?.image_url}
                                  alt={establishmentsById.get(review.establishment_id)?.name || "Establishment"}
                                  className="card-img"
                                />
                              ) : (
                                <div className="card-img-placeholder">
                                  <span>{(establishmentsById.get(review.establishment_id)?.name || review.establishment_id || "S")?.[0] || "S"}</span>
                                </div>
                              )}
                            </div>
                            <div className="card-content">
                              <div className="card-header-row">
                                <div className="review-title">{review.title || "Untitled review"}</div>
                                <div className="review-stars">
                                  {Number(review.stars) || 0} ★
                                </div>
                              </div>
                              <div className="review-sub" style={{ fontWeight: 600, color: "var(--primary)", fontSize: "0.85rem", marginBottom: "6px" }}>
                                {establishmentsById.get(review.establishment_id)?.name || "Unknown Place"}
                              </div>
                              <div className="review-sub card-desc">
                                {truncateWithEllipsis(review.description, HOME_REVIEW_DESCRIPTION_MAX_CHARS)}
                              </div>
                              
                              <div className="card-footer">
                                {Array.isArray(review.tags) && review.tags.length > 0 ? (
                                  <div className="review-tags">
                                    {review.tags.slice(0, 3).map((tag) => {
                                      const tagColor = getTagColor(tag)
                                      return (
                                        <span
                                          key={`${review.id}-${tag}`}
                                          className="tag"
                                          style={{ background: tagColor.background, color: tagColor.color }}
                                        >
                                          #{tag}
                                        </span>
                                      )
                                    })}
                                    {review.tags.length > 3 && <span className="tag" style={{background: "#f3f4f6"}}>+{review.tags.length - 3}</span>}
                                  </div>
                                ) : <div />}
                                
                                <button className="primary-button alt watch-button" style={{ width: "100%", marginTop: "12px", padding: "8px" }} onClick={() => loadReviewDetail(review.id)} disabled={loadingSelectedReview}>
                                  {loadingSelectedReview && loadingReviewId === review.id ? "Loading..." : "See more"}
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </section>

              <div className="sidebar-panels leaderboard-panel">
                <aside className="panel">
                  <div className="panel-header">
                    <h3 className="panel-title">Leaderboard</h3>
                    <span className="pill">Top</span>
                  </div>
                  {loadingLeaderboard ? (
                    <p>Loading leaderboard...</p>
                  ) : (
                    leaderboard.map((entry, index) => (
                      <div className="leaderboard-entry" key={entry.user_id || index}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <strong>#{index + 1}</strong>
                          <img
                            src={(entry.avatar_url || "").trim() || getDefaultAvatarUrl(entry.user_id || entry.name || index)}
                            alt={entry.name || "User"}
                            style={{ width: "34px", height: "34px", borderRadius: "50%", objectFit: "cover", border: "1px solid #e5e7eb" }}
                          />
                          <span>{entry.name || "Anon"}</span>
                        </div>
                        <div className="pill">{entry.total_points} pts</div>
                      </div>
                    ))
                  )}
                  <button className="ghost-button" style={{ marginTop: "16px" }}>
                    View full ranking
                  </button>
                </aside>

                <aside className="panel">
                  <div className="panel-header">
                    <h3 className="panel-title">Top Establishments</h3>
                    <span className="pill">Reviews</span>
                  </div>
                  {loadingTopEstablishments ? (
                    <p>Loading top establishments...</p>
                  ) : topEstablishments.length === 0 ? (
                    <p>No hay reviews suficientes todavía.</p>
                  ) : (
                    topEstablishments.map((entry, index) => {
                      const stars = Math.round(Number(entry.avg_stars || 0))
                      return (
                        <div className="leaderboard-entry" key={entry.id || index}>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <strong>#{index + 1}</strong>
                            {(entry.image_url || "").trim() ? (
                              <img
                                src={(entry.image_url || "").trim()}
                                alt={entry.name || "Establishment"}
                                style={{ width: "34px", height: "34px", borderRadius: "50%", objectFit: "cover", border: "1px solid #e5e7eb" }}
                              />
                            ) : (
                              <div
                                style={{
                                  width: "34px",
                                  height: "34px",
                                  borderRadius: "50%",
                                  border: "1px solid #e5e7eb",
                                  display: "grid",
                                  placeItems: "center",
                                  background: "var(--surface-alt)",
                                  color: "var(--muted)",
                                  fontWeight: 700,
                                  fontSize: "0.78rem",
                                }}
                              >
                                {(entry.name || "E")?.[0] || "E"}
                              </div>
                            )}
                            <span>{entry.name || "Establishment"}</span>
                          </div>
                          <div style={{ display: "grid", justifyItems: "end", gap: "3px" }}>
                            <div className="pill">{Number(entry.review_count || 0)} reviews</div>
                            <div className="review-stars" style={{ fontSize: "0.82rem" }}>
                              {"★".repeat(stars)}
                              {"☆".repeat(5 - stars)} ({Number(entry.avg_stars || 0).toFixed(1)})
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </aside>
              </div>
            </div>
          </>
        )}

        {activePage === "review" && (
          <div className="grid">
            <section className="panel" style={{ gridColumn: "1 / 2" }}>
              <div className="panel-header">
                <h3 className="panel-title">Write a review</h3>
                <span className="pill">Review</span>
              </div>          
              <div className="input-group">
                {reviewWizardStep === 1 && (
                  <div className="selected-establishment-card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
                      <strong>Paso 1: Rubro</strong>
                    </div>
                    <div style={{ fontSize: "12px", color: "#6b7280" }}>
                      Elige el rubro del establecimiento.
                    </div>
                    <select
                      className="input"
                      value={establishmentCategory}
                      onChange={(event) => handleCategorySelection(event.target.value)}
                      disabled={locationSearch.loading || locationSearch.geolocating || locationSearch.resolving}
                    >
                      <option value="">Selecciona un rubro</option>
                      {ESTABLISHMENT_CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                      <button type="button" className="primary-button" onClick={() => goToNextWizardStep(1, 2)}>
                        Siguiente
                      </button>
                    </div>
                  </div>
                )}

                {hasSelectedCategory && reviewWizardStep === 2 && (
                  <div className="selected-establishment-card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
                      <strong>Paso 2: Establecimiento</strong>
                    </div>
                    <>
                        <div className="map-search-box">
                          <div style={{ fontSize: "12px", color: "#6b7280" }}>
                            Busca por dirección o nombre y selecciona un resultado:
                          </div>
                          <div className="map-search-row">
                            <input
                              className="input"
                              placeholder="Ej: Saga Falabella Miraflores o Av. Larco 345, Miraflores"
                              value={locationSearch.query}
                              onChange={(event) =>
                                setLocationSearch((prev) => ({ ...prev, query: event.target.value, error: "" }))
                              }
                            />
                            <button
                              type="button"
                              className="ghost-button"
                              onClick={searchLocationsByAddress}
                              disabled={locationSearch.loading || locationSearch.geolocating || locationSearch.resolving}
                            >
                              {locationSearch.loading ? "Buscando..." : "Buscar en mapa"}
                            </button>
                            <button
                              type="button"
                              className="ghost-button"
                              onClick={locateCurrentPosition}
                              disabled={locationSearch.loading || locationSearch.geolocating || locationSearch.resolving}
                            >
                              {locationSearch.geolocating ? "Ubicando..." : "Usar mi ubicación"}
                            </button>
                          </div>
                          {locationSearch.error && (
                            <div style={{ fontSize: "12px", color: "#b91c1c" }}>
                              {locationSearch.error}
                            </div>
                          )}
                          {locationSearch.results.length > 0 && (
                            <div className="map-results-list">
                              {locationSearch.results.map((result) => (
                                <button
                                  type="button"
                                  key={result.id}
                                  className={`map-result-item ${
                                    locationSearch.selected?.id === result.id || locationSearch.resolvedId === result.id ? "active" : ""
                                  }`}
                                  onClick={() => pickLocationCandidate(result)}
                                  disabled={locationSearch.loading || locationSearch.resolving}
                                >
                                  <strong>{result.name}</strong>
                                  <span>{result.address}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        {selectedEstablishment && (
                          <div style={{ display: "grid", gap: "10px" }}>
                            <div className="selected-establishment-status">
                              Establecimiento seleccionado
                            </div>
                            <div style={{ display: "grid", gap: "4px" }}>
                              {locationSearch.selected?.source === "geolocation" ? (
                                <div style={{ display: "grid", gap: "6px" }}>
                                  <label style={{ fontSize: "12px", color: "var(--muted)" }}>
                                    Nombre del establecimiento (editable):
                                  </label>
                                  <input
                                    className="input"
                                    placeholder="Ingresa el nombre del establecimiento"
                                    value={locationSearch.selected?.name || ""}
                                    onChange={(event) => {
                                      const nextName = event.target.value
                                      setLocationSearch((prev) => ({
                                        ...prev,
                                        selected: prev.selected ? { ...prev.selected, name: nextName } : prev.selected,
                                        error: "",
                                      }))
                                    }}
                                    disabled={locationSearch.resolving}
                                  />
                                  <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                                    El nombre se guardará al confirmar el establecimiento.
                                  </span>
                                </div>
                              ) : (
                                <strong>{selectedEstablishment.name}</strong>
                              )}
                              <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                                {selectedEstablishment.address || "Dirección no disponible"}
                              </span>
                              <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
                                {[
                                  selectedEstablishment.district,
                                  selectedEstablishment.state_region,
                                  selectedEstablishment.country,
                                ].filter(Boolean).join(" · ") || "Ubicación administrativa no disponible"}
                              </span>
                              <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
                                Rubro: {selectedEstablishment.category || establishmentCategory}
                              </span>
                            </div>
                            <div className="selected-establishment-media">
                              {selectedEstablishment.image_url && (
                                <img
                                  src={selectedEstablishment.image_url}
                                  alt={selectedEstablishment.name || "Establishment"}
                                />
                              )}
                              {toNumberOrNull(selectedEstablishment.latitude) != null &&
                                toNumberOrNull(selectedEstablishment.longitude) != null && (
                                <iframe
                                  title="Selected establishment map"
                                  src={buildEmbeddedMapUrl({
                                    latitude: toNumberOrNull(selectedEstablishment.latitude),
                                    longitude: toNumberOrNull(selectedEstablishment.longitude),
                                  })}
                                  loading="lazy"
                                  referrerPolicy="no-referrer-when-downgrade"
                                />
                              )}
                            </div>
                            <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                              Imagen del establecimiento: elige una existente o sube una.
                            </div>
                            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                              <label style={{ display: "inline-flex", gap: "6px", alignItems: "center", fontSize: "12px", color: "var(--muted)" }}>
                                <input
                                  type="radio"
                                  name="establishment-image-mode"
                                  checked={imageSourceMode === "existing"}
                                  onChange={() => {
                                    setImageSourceMode("existing")
                                    if (!imageSuggestions.selected && imageSuggestions.items[0]) {
                                      setImageSuggestions((prev) => ({ ...prev, selected: prev.items[0] || "" }))
                                    }
                                  }}
                                  disabled={locationSearch.resolving}
                                />
                                Usar imagen existente (DB)
                              </label>
                              <label style={{ display: "inline-flex", gap: "6px", alignItems: "center", fontSize: "12px", color: "var(--muted)" }}>
                                <input
                                  type="radio"
                                  name="establishment-image-mode"
                                  checked={imageSourceMode === "upload"}
                                  onChange={() => {
                                    setImageSourceMode("upload")
                                    setImageSuggestions((prev) => ({ ...prev, selected: "" }))
                                  }}
                                  disabled={locationSearch.resolving}
                                />
                                Subir imagen
                              </label>
                            </div>
                            {imageSourceMode === "upload" && (
                              <div>
                                <FileUpload
                                  accept="image/jpeg,image/png,image/webp"
                                  onFile={(file) => uploadSelectedEstablishmentImage(file)}
                                  disabled={uploadingSelectedEstablishmentImage || locationSearch.resolving}
                                />
                                {uploadingSelectedEstablishmentImage && (
                                  <div style={{ fontSize: "12px", color: "var(--muted)" }}>Subiendo imagen...</div>
                                )}
                              </div>
                            )}
                            {imageSuggestions.loading && <div style={{ fontSize: "12px", color: "var(--muted)" }}>Buscando imágenes sugeridas...</div>}
                            {imageSuggestions.error && <div style={{ fontSize: "12px", color: "#b91c1c" }}>{imageSuggestions.error}</div>}
                            {imageSourceMode === "existing" && imageSuggestions.items.length > 0 && (
                              <div className="suggested-images-grid">
                                {imageSuggestions.items.map((imageUrl) => (
                                  <button
                                    type="button"
                                    key={imageUrl}
                                    className={`suggested-image-option ${imageSuggestions.selected === imageUrl ? "active" : ""}`}
                                    onClick={() => setImageSuggestions((prev) => ({ ...prev, selected: imageUrl }))}
                                    disabled={locationSearch.resolving}
                                  >
                                    <img src={imageUrl} alt="Suggested establishment" />
                                  </button>
                                ))}
                              </div>
                            )}
                            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                              <button
                                type="button"
                                className="ghost-button"
                                onClick={() => {
                                  setReviewForm((prev) => ({
                                    ...prev,
                                    establishment_id: "",
                                    title: "",
                                    description: "",
                                    stars: 0,
                                    price: "",
                                    purchase_url: "",
                                    tags: "",
                                    evidence_images: [],
                                  }))
                                  setLocationSearch((prev) => ({ ...prev, selected: null, resolvedId: "", error: "" }))
                                }}
                                disabled={locationSearch.resolving}
                              >
                                Cambiar establecimiento
                              </button>
                              <button
                                type="button"
                                className="primary-button"
                                onClick={resolveAndSelectEstablishment}
                                disabled={
                                  !locationSearch.selected ||
                                  !String(locationSearch.selected?.name || "").trim() ||
                                  locationSearch.resolving ||
                                  (imageSourceMode === "upload" && !imageSuggestions.selected)
                                }
                              >
                                {locationSearch.resolving ? "Guardando establecimiento..." : "Confirmar establecimiento"}
                              </button>
                            </div>
                            {reviewForm.establishment_id && (
                              <div style={{ fontSize: "12px", color: "#166534" }}>
                                Establecimiento confirmado para esta reseña.
                              </div>
                            )}
                          </div>
                        )}
                        {!selectedEstablishment && (
                          <div className="selected-establishment-card">
                            <iframe
                              title="Location map"
                              src={buildEmbeddedMapUrl({
                                latitude: locationSearch.mapCenter.latitude,
                                longitude: locationSearch.mapCenter.longitude,
                              })}
                              loading="lazy"
                              referrerPolicy="no-referrer-when-downgrade"
                            />
                          </div>
                        )}
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
                          <button type="button" className="ghost-button" onClick={() => setReviewWizardStep(1)}>
                            Atrás
                          </button>
                          <button type="button" className="primary-button" onClick={() => goToNextWizardStep(2, 3)}>
                            Siguiente
                          </button>
                        </div>
                    </>
                  </div>
                )}

                {hasConfirmedEstablishment && reviewWizardStep === 3 && (
                  <div className="selected-establishment-card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
                      <strong>Paso 3: Título</strong>
                    </div>
                    <>
                        <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "6px" }}>
                          Título breve y claro (máx {MAX_REVIEW_TITLE_WORDS} palabras).
                        </div>
                        <div style={{ marginBottom: "6px", fontSize: "12px", color: "#6b7280" }}>
                          {reviewTitleWordCount}/{MAX_REVIEW_TITLE_WORDS} palabras
                        </div>
                        <input
                          className="input"
                          placeholder="Review title"
                          value={reviewForm.title}
                          onChange={(event) =>
                            setReviewForm({ ...reviewForm, title: event.target.value })
                          }
                        />
                        {!hasValidReviewTitle && String(reviewForm.title || "").trim() && (
                          <div style={{ fontSize: "12px", color: "#b91c1c" }}>
                            El título debe tener máximo {MAX_REVIEW_TITLE_WORDS} palabras.
                          </div>
                        )}
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
                          <button type="button" className="ghost-button" onClick={() => setReviewWizardStep(2)}>
                            Atrás
                          </button>
                          <button type="button" className="primary-button" onClick={() => goToNextWizardStep(3, 4)}>
                            Siguiente
                          </button>
                        </div>
                    </>
                  </div>
                )}

                {reviewWizardStep === 4 && hasValidReviewTitle && (
                  <div className="selected-establishment-card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
                      <strong>Paso 4: Descripción</strong>
                    </div>
                    <>
                        <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "6px" }}>
                          Describe tu experiencia con detalles: qué compraste o lo que sucedió, cómo te atendieron y la fecha aproximada. Evita incluir datos personales.
                        </div>
                        <textarea
                          className="input"
                          rows={4}
                          placeholder="Describe your experience"
                          value={reviewForm.description}
                          onChange={(event) =>
                            setReviewForm({ ...reviewForm, description: event.target.value })
                          }
                        />
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
                          <button type="button" className="ghost-button" onClick={() => setReviewWizardStep(3)}>
                            Atrás
                          </button>
                          <button type="button" className="primary-button" onClick={() => setReviewWizardStep(5)}>
                            Siguiente
                          </button>
                        </div>
                    </>
                  </div>
                )}

                {reviewWizardStep === 5 && hasValidReviewTitle && (
                  <div className="selected-establishment-card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
                      <strong>Paso 5: Valoración</strong>
                    </div>
                    <>
                        <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "6px" }}>
                          Selecciona entre 1 (muy mala) y 5 (excelente).
                        </div>
                        <div className="rating-picker" aria-label="Review stars">
                          {[1, 2, 3, 4, 5].map((starValue) => (
                            <button
                              key={`review-star-${starValue}`}
                              type="button"
                              className={`rating-star ${Number(reviewForm.stars) >= starValue ? "active" : ""}`}
                              onClick={() => setReviewForm({ ...reviewForm, stars: starValue })}
                              aria-label={`Set ${starValue} stars`}
                            >
                              ★
                            </button>
                          ))}
                          <button
                            type="button"
                            className="ghost-button rating-clear"
                            onClick={() => setReviewForm({ ...reviewForm, stars: 0 })}
                          >
                            Clear
                          </button>
                        </div>
                        <div style={{ fontSize: "14px", color: "#374151", marginTop: "6px" }}>
                          Stars: <strong>{reviewForm.stars}</strong>/5
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
                          <button type="button" className="ghost-button" onClick={() => setReviewWizardStep(4)}>
                            Atrás
                          </button>
                          <button type="button" className="primary-button" onClick={() => setReviewWizardStep(6)}>
                            Siguiente
                          </button>
                        </div>
                    </>
                  </div>
                )}

                {reviewWizardStep === 6 && hasValidReviewTitle && (
                  <div className="selected-establishment-card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
                      <strong>Paso 6: Precio</strong>
                    </div>
                    <>
                        <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "6px" }}>
                          Opcional: indica el precio en soles (ej. 39.90).
                        </div>
                        <input
                          className="input"
                          type="number"
                          placeholder="Price (PEN)"
                          value={reviewForm.price}
                          onChange={(event) =>
                            setReviewForm({ ...reviewForm, price: event.target.value })
                          }
                        />
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
                          <button type="button" className="ghost-button" onClick={() => setReviewWizardStep(5)}>
                            Atrás
                          </button>
                          <button type="button" className="primary-button" onClick={() => setReviewWizardStep(7)}>
                            Siguiente
                          </button>
                        </div>
                    </>
                  </div>
                )}

                {reviewWizardStep === 7 && hasValidReviewTitle && (
                  <div className="selected-establishment-card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
                      <strong>Paso 7: Purchase URL</strong>
                    </div>
                    <>
                        <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "6px" }}>
                          Opcional: pega un enlace de compra, ticket o producto.
                        </div>
                        <input
                          className="input"
                          placeholder="Purchase URL"
                          value={reviewForm.purchase_url}
                          onChange={(event) =>
                            setReviewForm({ ...reviewForm, purchase_url: event.target.value })
                          }
                        />
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
                          <button type="button" className="ghost-button" onClick={() => setReviewWizardStep(6)}>
                            Atrás
                          </button>
                          <button type="button" className="primary-button" onClick={() => setReviewWizardStep(8)}>
                            Siguiente
                          </button>
                        </div>
                    </>
                  </div>
                )}

                {reviewWizardStep === 8 && hasValidReviewTitle && (
                  <div className="selected-establishment-card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
                      <strong>Paso 8: Tags</strong>
                    </div>
                    <>
                        <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "6px" }}>
                          Usa tags separadas por comas (ej.: delivery, atención, calidad).
                        </div>
                        <input
                          className="input"
                          placeholder="Tags (comma separated)"
                          value={reviewForm.tags}
                          onChange={(event) =>
                            setReviewForm({ ...reviewForm, tags: event.target.value })
                          }
                        />
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
                          <button type="button" className="ghost-button" onClick={() => setReviewWizardStep(7)}>
                            Atrás
                          </button>
                          <button type="button" className="primary-button" onClick={() => setReviewWizardStep(9)}>
                            Siguiente
                          </button>
                        </div>
                    </>
                  </div>
                )}

                {reviewWizardStep === 9 && hasValidReviewTitle && (
                  <div className="selected-establishment-card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
                      <strong>Paso 9: Subir validación</strong>
                    </div>
                    <>
                        <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "6px" }}>
                          Formato permitido: JPG, PNG, WEBP. Mínimo {MIN_REVIEW_EVIDENCE_IMAGES}, máximo {MAX_REVIEW_EVIDENCE_IMAGES} imágenes.
                        </div>
                        <FileUpload
                          accept="image/jpeg,image/png,image/webp"
                          onFile={(file) => uploadReviewEvidenceImage(file)}
                          disabled={!token || uploadingReviewEvidence || reviewForm.evidence_images.length >= MAX_REVIEW_EVIDENCE_IMAGES}
                        />
                        {!token && (
                          <div style={{ fontSize: "12px", color: "#b91c1c" }}>
                            Debes iniciar sesión con tu wallet para subir evidencias.
                          </div>
                        )}
                        {uploadingReviewEvidence && <p>Subiendo evidencia...</p>}
                        <div style={{ display: "grid", gap: "8px" }}>
                          <div style={{ fontSize: "12px", color: "#6b7280" }}>
                            Evidencias: {reviewForm.evidence_images.length}/{MAX_REVIEW_EVIDENCE_IMAGES} (mínimo {MIN_REVIEW_EVIDENCE_IMAGES})
                          </div>
                          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                            {reviewForm.evidence_images.map((imageUrl, index) => (
                              <div key={`${imageUrl}-${index}`} style={{ display: "grid", gap: "6px" }}>
                                <img
                                  src={imageUrl}
                                  alt={`Evidence ${index + 1}`}
                                  style={{ width: "120px", height: "84px", objectFit: "cover", borderRadius: "8px", border: "1px solid #e5e7eb" }}
                                />
                                <button className="ghost-button" onClick={() => removeReviewEvidenceImage(index)}>
                                  Quitar
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                        {reviewCaptcha.loading && (
                          <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                            Cargando captcha...
                          </div>
                        )}
                        {reviewCaptcha.requiresCaptcha && (
                          <div style={{ display: "grid", gap: "8px" }}>
                            <div style={{ fontSize: "12px", color: "#6b7280" }}>
                              Verificación adicional: ya tienes reseñas previas. Resuelve el captcha para enviar una nueva.
                            </div>
                            <div style={{ fontSize: "14px", fontWeight: 600 }}>
                              {reviewCaptcha.challenge || "Captcha no disponible"}
                            </div>
                            <input
                              className="input"
                              placeholder="Respuesta del captcha"
                              value={reviewCaptcha.answer}
                              onChange={(event) =>
                                setReviewCaptcha((prev) => ({ ...prev, answer: event.target.value, error: "" }))
                              }
                            />
                            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                              <button
                                type="button"
                                className="ghost-button"
                                onClick={fetchReviewCaptchaChallenge}
                                disabled={reviewCaptcha.loading}
                              >
                                {reviewCaptcha.loading ? "Recargando..." : "Recargar captcha"}
                              </button>
                              {reviewCaptcha.expiresAt && (
                                <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                                  Expira: {new Date(reviewCaptcha.expiresAt).toLocaleTimeString()}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                        {reviewCaptcha.error && (
                          <div style={{ fontSize: "12px", color: "#b91c1c" }}>
                            {reviewCaptcha.error}
                          </div>
                        )}
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
                          <button type="button" className="ghost-button" onClick={() => setReviewWizardStep(8)}>
                            Atrás
                          </button>
                        </div>
                    </>
                  </div>
                )}
              </div>
              {reviewWizardStatus && (
                <div style={{ marginTop: "10px", color: "#b91c1c", fontSize: "13px" }}>
                  {reviewWizardStatus}
                </div>
              )}
              {hasConfirmedEstablishment && hasValidReviewTitle && reviewWizardStep === 9 && (
                <button
                  className="primary-button"
                  onClick={submitReview}
                  disabled={
                    submittingReview ||
                    reviewTx.step === "preparing" ||
                    reviewTx.step === "signing" ||
                    reviewTx.step === "pending" ||
                    (reviewCaptcha.requiresCaptcha && !String(reviewCaptcha.answer || "").trim())
                  }
                >
                  {submittingReview || reviewTx.step === "preparing" || reviewTx.step === "signing" || reviewTx.step === "pending"
                    ? "Submitting..."
                    : "Submit review"}
                </button>
              )}
              {authStatus && (
                <div style={{ marginTop: "12px", color: "#e85151" }}>
                  {authStatus}
                </div>
              )}
            </section>
          </div>
        )}

        {activePage === "review-detail" && (
          <div className="grid">
            <section className="panel" style={{ gridColumn: "1 / 2" }}>
              <div className="panel-header">
                <h3 className="panel-title">Review details</h3>
                <button className="ghost-button" onClick={() => setActivePage("reviews")}>
                  ← Back to reviews
                </button>
              </div>
              {!selectedReview ? (
                <p>No review selected.</p>
              ) : (
                <div className="input-group">
                  <div className="review-row">
                    <div className="review-thumb review-thumb-detail" style={{ padding: 0, overflow: "hidden" }}>
                      {establishmentsById.get(selectedReview.establishment_id)?.image_url ? (
                        <img
                          src={establishmentsById.get(selectedReview.establishment_id)?.image_url}
                          alt={establishmentsById.get(selectedReview.establishment_id)?.name || "Establishment"}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        <span>{(establishmentsById.get(selectedReview.establishment_id)?.name || selectedReview.establishment_id || "S")?.[0] || "S"}</span>
                      )}
                    </div>
                    <div>
                      <div className="review-title">{selectedReview.title || "Untitled review"}</div>
                      <div className="review-sub">{establishmentsById.get(selectedReview.establishment_id)?.name || selectedReview.establishment_id}</div>
                      <div className="review-stars" style={{ marginTop: "6px" }}>
                        {"★".repeat(Number(selectedReview.stars) || 0)}
                        {"☆".repeat(5 - (Number(selectedReview.stars) || 0))}
                      </div>
                    </div>
                  </div>
                  <div>
                    <strong>Description</strong>
                    <p style={{ marginTop: "6px" }}>{selectedReview.description}</p>
                  </div>
                  <div className="chain-proof">
                    <strong>Blockchain proof</strong>
                    <div style={{ marginTop: "8px", display: "grid", gap: "8px" }}>
                      <div className="pill" style={{ width: "fit-content" }}>
                        Network: Syscoin Devnet (Chain ID: {CHAIN_ID || "N/A"})
                      </div>
                      {reviewChainInfo.loading && <div>Checking on-chain event...</div>}
                      {!reviewChainInfo.loading && reviewChainInfo.anchored && (
                        <div style={{ display: "grid", gap: "6px" }}>
                          <div className="pill" style={{ width: "fit-content", color: "#166534", background: "#dcfce7" }}>
                            Anchored on-chain
                          </div>
                          <div>
                            Tx hash:
                            {" "}
                            <code style={{ wordBreak: "break-all" }}>{reviewChainInfo.txHash}</code>
                          </div>
                          {reviewChainInfo.blockNumber != null && <div>Block: {reviewChainInfo.blockNumber}</div>}
                          {reviewChainInfo.blockTimestamp && (
                            <div>Block time: {new Date(reviewChainInfo.blockTimestamp).toLocaleString()}</div>
                          )}
                          {explorerBaseUrl && reviewChainInfo.txHash && (
                            <>
                              <a href={`${explorerBaseUrl}/tx/${reviewChainInfo.txHash}`} target="_blank" rel="noreferrer">
                                View transaction on explorer
                              </a>
                              <div>
                                Explorer tx URL:
                                {" "}
                                <code style={{ wordBreak: "break-all" }}>{`${explorerBaseUrl}/tx/${reviewChainInfo.txHash}`}</code>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                      {!reviewChainInfo.loading && !reviewChainInfo.anchored && !selectedReview.tx_hash && !reviewChainInfo.error && !reviewChainInfo.unavailable && (
                        <div className="pill" style={{ width: "fit-content", color: "#92400e", background: "#fef3c7" }}>
                          Pending anchor or event not found yet
                        </div>
                      )}
                      {reviewChainInfo.unavailable && (
                        <div className="pill" style={{ width: "fit-content", color: "#92400e", background: "#fef3c7" }}>
                          {reviewChainInfo.unavailable}
                        </div>
                      )}
                      {reviewChainInfo.error && (
                        <div style={{ color: "#991b1b" }}>{reviewChainInfo.error}</div>
                      )}
                    </div>
                  </div>
                  {Array.isArray(selectedReview.tags) && selectedReview.tags.length > 0 && (
                    <div className="review-tags">
                      {selectedReview.tags.map((tag) => {
                        const tagColor = getTagColor(tag)
                        return (
                          <span
                            key={`detail-${selectedReview.id}-${tag}`}
                            className="tag"
                            style={{ background: tagColor.background, color: tagColor.color }}
                          >
                            #{tag}
                          </span>
                        )
                      })}
                    </div>
                  )}
                  {Array.isArray(selectedReview.evidence_images) && selectedReview.evidence_images.length > 0 && (
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      {selectedReview.evidence_images.map((imageUrl, index) => (
                        <img
                          key={`${selectedReview.id}-evidence-${index}`}
                          src={imageUrl}
                          alt={`Evidence ${index + 1}`}
                          style={{ width: "180px", height: "120px", objectFit: "cover", borderRadius: "8px", border: "1px solid #e5e7eb" }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        )}

        {activePage === "profile" && (
          <div className="grid">
            <section className="panel" style={{ gridColumn: "1 / 2" }}>
              <div className="panel-header">
                <h3 className="panel-title">Mi perfil</h3>
                <span className="pill">Profile</span>
              </div>
              <div className="input-group">
                <input
                  className="input"
                  placeholder="Name"
                  value={profile.name}
                  onChange={(event) => setProfile({ ...profile, name: event.target.value })}
                />
                <FileUpload
                  accept="image/jpeg,image/png,image/webp"
                  onFile={(file) => uploadProfileAvatar(file)}
                  disabled={uploadingAvatar || profileBusy}
                />
                {uploadingAvatar && <p>Subiendo avatar...</p>}
                {profile.avatar_url && (
                  <img
                    src={profile.avatar_url}
                    alt="Profile avatar"
                    style={{ width: "120px", height: "120px", objectFit: "cover", borderRadius: "50%", border: "1px solid #e5e7eb" }}
                  />
                )}
                <input
                  className="input"
                  placeholder="Avatar URL"
                  value={profile.avatar_url}
                  onChange={(event) => setProfile({ ...profile, avatar_url: event.target.value })}
                />
                <input
                  className="input"
                  placeholder="Email (optional)"
                  value={profile.email}
                  onChange={(event) => setProfile({ ...profile, email: event.target.value })}
                />
              </div>
              <button className="primary-button" onClick={saveProfile} disabled={profileBusy}>
                {profileBusy ? "Guardando..." : "Guardar cambios"}
              </button>
              {profileStatus && (
                <div style={{ marginTop: "12px", color: "#e85151" }}>
                  {profileStatus}
                </div>
              )}
            </section>
          </div>
        )}

        {activePage === "admin-establishments" && isAdmin && (
          <div className="grid">
            <section className="panel" style={{ gridColumn: "1 / 2" }}>
              <div className="panel-header">
                <h3 className="panel-title">Crear nuevo establishment</h3>
                <span className="pill">Admin</span>
              </div>
              <div className="input-group">
                <input
                  className="input"
                  placeholder="Name"
                  value={newEstablishment.name}
                  onChange={(event) =>
                    setNewEstablishment({ ...newEstablishment, name: event.target.value })
                  }
                />
                <input
                  className="input"
                  placeholder="Category"
                  value={newEstablishment.category}
                  onChange={(event) =>
                    setNewEstablishment({ ...newEstablishment, category: event.target.value })
                  }
                />
                <input
                  className="input"
                  placeholder="Address (optional)"
                  value={newEstablishment.address}
                  onChange={(event) =>
                    setNewEstablishment({ ...newEstablishment, address: event.target.value })
                  }
                />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                  <input
                    className="input"
                    placeholder="Country"
                    value={newEstablishment.country}
                    onChange={(event) =>
                      setNewEstablishment({ ...newEstablishment, country: event.target.value })
                    }
                  />
                  <input
                    className="input"
                    placeholder="State / Region"
                    value={newEstablishment.state_region}
                    onChange={(event) =>
                      setNewEstablishment({ ...newEstablishment, state_region: event.target.value })
                    }
                  />
                  <input
                    className="input"
                    placeholder="District / City"
                    value={newEstablishment.district}
                    onChange={(event) =>
                      setNewEstablishment({ ...newEstablishment, district: event.target.value })
                    }
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <input
                    className="input"
                    type="number"
                    step="0.000001"
                    placeholder="Latitude"
                    value={newEstablishment.latitude}
                    onChange={(event) =>
                      setNewEstablishment({ ...newEstablishment, latitude: event.target.value })
                    }
                  />
                  <input
                    className="input"
                    type="number"
                    step="0.000001"
                    placeholder="Longitude"
                    value={newEstablishment.longitude}
                    onChange={(event) =>
                      setNewEstablishment({ ...newEstablishment, longitude: event.target.value })
                    }
                  />
                </div>
                <FileUpload
                  accept="image/jpeg,image/png,image/webp"
                  onFile={(file) => uploadEstablishmentImage(file)}
                  disabled={uploadingEstablishmentImage}
                />
                <input
                  className="input"
                  placeholder="Image URL"
                  value={newEstablishment.image_url}
                  onChange={(event) =>
                    setNewEstablishment({ ...newEstablishment, image_url: event.target.value })
                  }
                />
                {newEstablishment.image_url && (
                  <img
                    src={newEstablishment.image_url}
                    alt="Establishment preview"
                    style={{ width: "180px", maxWidth: "100%", borderRadius: "10px", border: "1px solid #e5e7eb" }}
                  />
                )}
              </div>
              {uploadingEstablishmentImage && <p>Subiendo imagen...</p>}
              <button className="primary-button" onClick={createAdminEstablishment}>
                Crear establishment
              </button>
              <div style={{ marginTop: "20px" }}>
                <h4 style={{ margin: "0 0 10px 0" }}>Establishments registrados</h4>
                <div className="establishments-list">
                  {establishments.map((est) => (
                    <div key={est.id} className="establishment-item">
                      {est.image_url ? (
                        <img
                          src={est.image_url}
                          alt={est.name || "Establishment"}
                          style={{ width: "120px", height: "84px", objectFit: "cover", borderRadius: "8px", border: "1px solid #e5e7eb" }}
                        />
                      ) : (
                        <div
                          style={{
                            width: "120px",
                            height: "84px",
                            borderRadius: "8px",
                            border: "1px solid #e5e7eb",
                            display: "grid",
                            placeItems: "center",
                            fontSize: "12px",
                            color: "#6b7280",
                            background: "#f8fafc",
                          }}
                        >
                          Sin imagen
                        </div>
                      )}
                      <div className="establishment-main">
                        <strong>{est.name || "Sin nombre"}</strong>
                        <span>{est.category || "Sin categoría"}</span>
                        {est.address && <span>{est.address}</span>}
                        {(est.district || est.state_region || est.country) && (
                          <span>{[est.district, est.state_region, est.country].filter(Boolean).join(" · ")}</span>
                        )}
                      </div>
                      <div className="establishment-actions">
                        {editingEstablishmentId === est.id ? (
                          <div className="input-group" style={{ marginBottom: 0 }}>
                          <input
                            className="input"
                            placeholder="Name"
                            value={editingEstablishment.name}
                            onChange={(event) =>
                              setEditingEstablishment({ ...editingEstablishment, name: event.target.value })
                            }
                          />
                          <input
                            className="input"
                            placeholder="Category"
                            value={editingEstablishment.category}
                            onChange={(event) =>
                              setEditingEstablishment({ ...editingEstablishment, category: event.target.value })
                            }
                          />
                          <input
                            className="input"
                            placeholder="Address (optional)"
                            value={editingEstablishment.address}
                            onChange={(event) =>
                              setEditingEstablishment({ ...editingEstablishment, address: event.target.value })
                            }
                          />
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                            <input
                              className="input"
                              placeholder="Country"
                              value={editingEstablishment.country}
                              onChange={(event) =>
                                setEditingEstablishment({ ...editingEstablishment, country: event.target.value })
                              }
                            />
                            <input
                              className="input"
                              placeholder="State / Region"
                              value={editingEstablishment.state_region}
                              onChange={(event) =>
                                setEditingEstablishment({ ...editingEstablishment, state_region: event.target.value })
                              }
                            />
                            <input
                              className="input"
                              placeholder="District / City"
                              value={editingEstablishment.district}
                              onChange={(event) =>
                                setEditingEstablishment({ ...editingEstablishment, district: event.target.value })
                              }
                            />
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                            <input
                              className="input"
                              type="number"
                              step="0.000001"
                              placeholder="Latitude"
                              value={editingEstablishment.latitude}
                              onChange={(event) =>
                                setEditingEstablishment({ ...editingEstablishment, latitude: event.target.value })
                              }
                            />
                            <input
                              className="input"
                              type="number"
                              step="0.000001"
                              placeholder="Longitude"
                              value={editingEstablishment.longitude}
                              onChange={(event) =>
                                setEditingEstablishment({ ...editingEstablishment, longitude: event.target.value })
                              }
                            />
                          </div>
                          <FileUpload
                            accept="image/jpeg,image/png,image/webp"
                            onFile={(file) => uploadEditingEstablishmentImage(file)}
                            disabled={uploadingEstablishmentImage || savingEstablishmentEdition}
                          />
                          <input
                            className="input"
                            placeholder="Image URL"
                            value={editingEstablishment.image_url}
                            onChange={(event) =>
                              setEditingEstablishment({ ...editingEstablishment, image_url: event.target.value })
                            }
                          />
                          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                            <button
                              className="primary-button"
                              onClick={saveEstablishmentEdition}
                              disabled={savingEstablishmentEdition}
                            >
                              {savingEstablishmentEdition ? "Guardando..." : "Guardar"}
                            </button>
                            <button className="ghost-button" onClick={cancelEditingEstablishment}>
                              Cancelar
                            </button>
                          </div>
                          </div>
                        ) : (
                          <button className="ghost-button" onClick={() => startEditingEstablishment(est)}>
                            Editar
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {!establishments.length && <p>No hay establishments registrados.</p>}
                </div>
              </div>
              {adminStatus && (
                <div style={{ marginTop: "12px", color: "#e85151" }}>
                  {adminStatus}
                </div>
              )}
            </section>
          </div>
        )}

        {activePage === "admin-users" && isAdmin && (
          <div className="grid">
            <section className="panel" style={{ gridColumn: "1 / 2" }}>
              <div className="panel-header">
                <h3 className="panel-title">Lista de usuarios</h3>
                <span className="pill">Admin</span>
              </div>
              {loadingAdminUsers ? (
                <p>Cargando usuarios...</p>
              ) : (
                <div className="input-group">
                  {adminUsers.map((user) => (
                    <div key={user.id} className="pill" style={{ display: "grid", gap: "4px" }}>
                      <strong>{user.name || "Sin nombre"}</strong>
                      <span>{user.email || "Sin email"}</span>
                      <span>{user.wallet_address || "Sin wallet"}</span>
                      <span>Rol: {user.role}</span>
                    </div>
                  ))}
                  {!adminUsers.length && <p>No hay usuarios registrados.</p>}
                </div>
              )}
              {adminStatus && (
                <div style={{ marginTop: "12px", color: "#e85151" }}>
                  {adminStatus}
                </div>
              )}
            </section>
          </div>
        )}

        {activePage === "admin-points" && isAdmin && (
          <div className="grid">
            <section className="panel" style={{ gridColumn: "1 / 2" }}>
              <div className="panel-header">
                <h3 className="panel-title">Configuración general Syspoints</h3>
                <span className="pill">Admin</span>
              </div>
              {loadingPointsConfig ? (
                <p>Cargando configuración...</p>
              ) : (
                <div className="input-group">
                  <label style={{ fontWeight: 600 }}>Avatar por defecto de usuarios</label>
                  <FileUpload
                    accept="image/jpeg,image/png,image/webp"
                    onFile={(file) => uploadDefaultUserAvatar(file)}
                    disabled={uploadingDefaultAvatar}
                  />
                  <input
                    className="input"
                    placeholder="Default user avatar URL"
                    value={pointsConfig.default_user_avatar_url}
                    onChange={(event) =>
                      setPointsConfig({ ...pointsConfig, default_user_avatar_url: event.target.value })
                    }
                  />
                  {uploadingDefaultAvatar && <p>Subiendo avatar por defecto...</p>}
                  {pointsConfig.default_user_avatar_url && (
                    <img
                      src={pointsConfig.default_user_avatar_url}
                      alt="Default avatar"
                      style={{ width: "88px", height: "88px", objectFit: "cover", borderRadius: "50%", border: "1px solid #e5e7eb" }}
                    />
                  )}
                  <label style={{ fontWeight: 600, marginTop: "10px" }}>Wallet logos</label>
                  <FileUpload
                    accept="image/jpeg,image/png,image/webp"
                    onFile={(file) => uploadWalletLogo("metamask", file)}
                    disabled={uploadingWalletLogoKey === "metamask"}
                    buttonText="Subir logo MetaMask"
                  />
                  {uploadingWalletLogoKey === "metamask" && <p>Subiendo logo MetaMask...</p>}
                  {pointsConfig.metamask_wallet_logo_url && (
                    <img
                      src={pointsConfig.metamask_wallet_logo_url}
                      alt="MetaMask logo"
                      style={{ width: "40px", height: "40px", objectFit: "contain", borderRadius: "8px", border: "1px solid #e5e7eb", background: "#fff" }}
                    />
                  )}
                  <FileUpload
                    accept="image/jpeg,image/png,image/webp"
                    onFile={(file) => uploadWalletLogo("pali", file)}
                    disabled={uploadingWalletLogoKey === "pali"}
                    buttonText="Subir logo PaliWallet"
                  />
                  {uploadingWalletLogoKey === "pali" && <p>Subiendo logo PaliWallet...</p>}
                  {pointsConfig.pali_wallet_logo_url && (
                    <img
                      src={pointsConfig.pali_wallet_logo_url}
                      alt="PaliWallet logo"
                      style={{ width: "40px", height: "40px", objectFit: "contain", borderRadius: "8px", border: "1px solid #e5e7eb", background: "#fff" }}
                    />
                  )}
                  <FileUpload
                    accept="image/jpeg,image/png,image/webp"
                    onFile={(file) => uploadWalletLogo("other", file)}
                    disabled={uploadingWalletLogoKey === "other"}
                    buttonText="Subir logo Other Wallet"
                  />
                  {uploadingWalletLogoKey === "other" && <p>Subiendo logo Other Wallet...</p>}
                  {pointsConfig.other_wallet_logo_url && (
                    <img
                      src={pointsConfig.other_wallet_logo_url}
                      alt="Other wallet logo"
                      style={{ width: "40px", height: "40px", objectFit: "contain", borderRadius: "8px", border: "1px solid #e5e7eb", background: "#fff" }}
                    />
                  )}
                  <p style={{ margin: 0, color: "#6b7280", fontSize: "0.85rem" }}>
                    Estándar recomendado: logo cuadrado {WALLET_LOGO_STANDARD_SIZE}x{WALLET_LOGO_STANDARD_SIZE}px, entrada máxima 1MB.
                  </p>
                  <label style={{ fontWeight: 600, marginTop: "10px" }}>Configuración de puntos por review</label>
                  <input
                    className="input"
                    type="number"
                    placeholder="image_points_yes"
                    value={pointsConfig.image_points_yes}
                    onChange={(event) =>
                      setPointsConfig({ ...pointsConfig, image_points_yes: event.target.value })
                    }
                  />
                  <input
                    className="input"
                    type="number"
                    placeholder="image_points_no"
                    value={pointsConfig.image_points_no}
                    onChange={(event) =>
                      setPointsConfig({ ...pointsConfig, image_points_no: event.target.value })
                    }
                  />
                  <input
                    className="input"
                    type="number"
                    placeholder="description_points_gt_200"
                    value={pointsConfig.description_points_gt_200}
                    onChange={(event) =>
                      setPointsConfig({ ...pointsConfig, description_points_gt_200: event.target.value })
                    }
                  />
                  <input
                    className="input"
                    type="number"
                    placeholder="description_points_lte_200"
                    value={pointsConfig.description_points_lte_200}
                    onChange={(event) =>
                      setPointsConfig({ ...pointsConfig, description_points_lte_200: event.target.value })
                    }
                  />
                  <input
                    className="input"
                    type="number"
                    placeholder="stars_points_yes"
                    value={pointsConfig.stars_points_yes}
                    onChange={(event) =>
                      setPointsConfig({ ...pointsConfig, stars_points_yes: event.target.value })
                    }
                  />
                  <input
                    className="input"
                    type="number"
                    placeholder="stars_points_no"
                    value={pointsConfig.stars_points_no}
                    onChange={(event) =>
                      setPointsConfig({ ...pointsConfig, stars_points_no: event.target.value })
                    }
                  />
                  <input
                    className="input"
                    type="number"
                    placeholder="price_points_lt_100"
                    value={pointsConfig.price_points_lt_100}
                    onChange={(event) =>
                      setPointsConfig({ ...pointsConfig, price_points_lt_100: event.target.value })
                    }
                  />
                  <input
                    className="input"
                    type="number"
                    placeholder="price_points_gte_100"
                    value={pointsConfig.price_points_gte_100}
                    onChange={(event) =>
                      setPointsConfig({ ...pointsConfig, price_points_gte_100: event.target.value })
                    }
                  />
                </div>
              )}
              <button className="primary-button" onClick={updateAdminPointsConfig} disabled={loadingPointsConfig}>
                Guardar configuración
              </button>
              {adminStatus && (
                <div style={{ marginTop: "12px", color: "#e85151" }}>
                  {adminStatus}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
      <Footer />
    </div>
  )
}

export default App
