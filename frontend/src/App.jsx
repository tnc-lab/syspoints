import { useEffect, useMemo, useState } from "react"
import { ethers } from "ethers"

import Header from "./components/Header"
import Footer from "./components/Footer"
import { API_BASE, ABI, CHAIN_ID, CONTRACT_ADDRESS, EXPLORER_TX_BASE_URL, RPC_URL } from "./config"
import "./App.css"

const DEFAULT_PAGE_SIZE = 6
const MAX_ESTABLISHMENT_IMAGE_INPUT_BYTES = 2_000_000
const ESTABLISHMENT_IMAGE_MAX_DIMENSION = 960
const MAX_REVIEW_EVIDENCE_IMAGES = 3
const MIN_REVIEW_EVIDENCE_IMAGES = 1
const MAX_REVIEW_TITLE_WORDS = 12
const normalizeAddress = (value) => {
  try {
    return value ? ethers.getAddress(value) : ""
  } catch {
    return ""
  }
}

const getWalletErrorMessage = (error, fallback = "Wallet connection failed.") => {
  if (error?.code === 4001) return "Request rejected in wallet."
  if (error?.code === -32002) return "Wallet request already pending. Open your wallet extension."
  return error?.message || fallback
}

const getChainProofErrorMessage = (error) => {
  const message = String(error?.message || "").trim()
  if (!message || /failed to fetch/i.test(message)) {
    return "No se pudo consultar la red en este momento (RPC/Explorer). Verifica VITE_RPC_URL y conexión."
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
  const [authStatus, setAuthStatus] = useState("")
  const [profileStatus, setProfileStatus] = useState("")
  const [profileBusy, setProfileBusy] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [showWalletModal, setShowWalletModal] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [walletModalMode, setWalletModalMode] = useState("connect")
  const [walletModalStatus, setWalletModalStatus] = useState("")
  const [walletFlowStep, setWalletFlowStep] = useState("idle")
  const [showTxModal, setShowTxModal] = useState(false)
  const [txModalVisible, setTxModalVisible] = useState(false)
  const [reviewTx, setReviewTx] = useState({
    step: "idle",
    message: "",
    points: 0,
    txHash: "",
    explorerUrl: "",
  })
  const [walletBusy, setWalletBusy] = useState(false)
  const [activePage, setActivePage] = useState("reviews")

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
  const [uploadingReviewEvidence, setUploadingReviewEvidence] = useState(false)

  const [reviews, setReviews] = useState([])
  const [reviewsMeta, setReviewsMeta] = useState({ page: 1, page_size: DEFAULT_PAGE_SIZE, total: 0 })
  const [leaderboard, setLeaderboard] = useState([])
  const [leaderMeta, setLeaderMeta] = useState({ page: 1, page_size: 5, total: 0 })
  const [loadingReviews, setLoadingReviews] = useState(false)
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false)
  const [establishments, setEstablishments] = useState([])
  const [selectedReview, setSelectedReview] = useState(null)
  const [loadingSelectedReview, setLoadingSelectedReview] = useState(false)
  const [loadingReviewId, setLoadingReviewId] = useState("")
  const [reviewChainInfo, setReviewChainInfo] = useState({
    loading: false,
    anchored: false,
    txHash: "",
    blockNumber: null,
    blockTimestamp: null,
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
  })
  const [loadingPointsConfig, setLoadingPointsConfig] = useState(false)
  const [uploadingDefaultAvatar, setUploadingDefaultAvatar] = useState(false)
  const [newEstablishment, setNewEstablishment] = useState({ name: "", category: "", image_url: "" })
  const [uploadingEstablishmentImage, setUploadingEstablishmentImage] = useState(false)
  const [editingEstablishmentId, setEditingEstablishmentId] = useState("")
  const [editingEstablishment, setEditingEstablishment] = useState({ name: "", category: "", image_url: "" })
  const [savingEstablishmentEdition, setSavingEstablishmentEdition] = useState(false)

  const getWalletProvider = () => {
    if (!window.ethereum) return null
    return new ethers.BrowserProvider(window.ethereum)
  }

  const readProvider = useMemo(() => {
    if (!RPC_URL) return null
    return new ethers.JsonRpcProvider(RPC_URL)
  }, [])
  const explorerBaseUrl = useMemo(() => {
    const value = String(EXPLORER_TX_BASE_URL || "").trim()
    if (!value) return ""
    return value.replace(/\/tx\/?$/i, "").replace(/\/+$/, "")
  }, [])

  const clearSession = () => {
    setToken("")
    setCurrentUserRole("")
    setWalletUserName("")
    localStorage.removeItem("syspoints_token")
    localStorage.removeItem("syspoints_user_name")
  }

  useEffect(() => {
    const updateNetwork = async () => {
      const provider = getWalletProvider()
      if (!provider) return
      try {
        const network = await provider.getNetwork()
        setWrongNetwork(Number(network.chainId) !== Number(import.meta.env.VITE_CHAIN_ID))
      } catch {
        setWrongNetwork(false)
      }
    }

    updateNetwork()
  }, [])

  useEffect(() => {
    if (!window.ethereum) return

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

      if (tokenWalletAddress && tokenWalletAddress.toLowerCase() !== nextAddress.toLowerCase()) {
        clearSession()
        setAuthStatus("Wallet account does not match current session. Please sign in again.")
      }
    }

    const handleChainChanged = (chainId) => {
      const parsedChainId = typeof chainId === "string" ? parseInt(chainId, 16) : Number(chainId)
      setWrongNetwork(Number(parsedChainId) !== Number(import.meta.env.VITE_CHAIN_ID))
    }

    const handleDisconnect = () => {
      setWalletAddress("")
      setWrongNetwork(false)
      clearSession()
      setAuthStatus("Wallet disconnected.")
    }

    window.ethereum.request({ method: "eth_accounts" }).then(handleAccountsChanged).catch(() => {})
    window.ethereum.on("accountsChanged", handleAccountsChanged)
    window.ethereum.on("chainChanged", handleChainChanged)
    window.ethereum.on("disconnect", handleDisconnect)

    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged)
      window.ethereum.removeListener("chainChanged", handleChainChanged)
      window.ethereum.removeListener("disconnect", handleDisconnect)
    }
  }, [walletAddress, token])

  useEffect(() => {
    fetchReviews(1)
    fetchLeaderboard(1)
    fetchEstablishments()
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

  const ensureNetwork = async () => {
    const chainId = Number(import.meta.env.VITE_CHAIN_ID)
    if (!window.ethereum || !chainId) return
    const hexChainId = `0x${chainId.toString(16)}`

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: hexChainId }],
      })
    } catch (err) {
      if (err?.code === 4001) {
        throw new Error("Network switch rejected in wallet.")
      }
      if (err.code === 4902) {
        await window.ethereum.request({
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

  const signInWithWallet = async (address, fallbackName = "") => {
    const normalizedAddress = normalizeAddress(address)
    const provider = getWalletProvider()
    if (!normalizedAddress || !provider) {
      throw new Error("Connect your wallet first.")
    }

    await ensureNetwork()
    const nonceResponse = await apiFetch("/auth/nonce", {
      method: "POST",
      body: JSON.stringify({ wallet_address: normalizedAddress }),
    })

    if (nonceResponse.nonce === "invalid") {
      return { needsRegistration: true }
    }

    const signer = await provider.getSigner(normalizedAddress)
    const message = `Syspoints login nonce: ${nonceResponse.nonce}`
    const signature = await signer.signMessage(message)
    const tokenResponse = await apiFetch("/auth/token", {
      method: "POST",
      body: JSON.stringify({ wallet_address: normalizedAddress, signature }),
    })

    persistSession(tokenResponse.access_token, fallbackName)
    try {
      const currentUser = await fetchCurrentUser(tokenResponse.access_token)
      hydrateProfileFromUser(currentUser)
    } catch {
      // keep session active even if profile fetch fails
    }
    setAuthStatus("Signed in successfully.")
    return { needsRegistration: false }
  }

  const connectWallet = async () => {
    if (!window.ethereum) {
      setWalletModalStatus("Wallet provider not found. Install MetaMask or PaliWallet.")
      return
    }

    setWalletBusy(true)
    setWalletFlowStep("network")
    setWalletModalStatus("")
    try {
      setWalletModalStatus("Switching network to Syscoin Devnet...")
      await ensureNetwork()

      setWalletFlowStep("accounts")
      setWalletModalStatus("Requesting wallet account...")
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" })
      const address = normalizeAddress(accounts?.[0] || "")
      if (!address) {
        throw new Error("No wallet account available.")
      }

      setWalletAddress(address)
      setWalletFlowStep("signin")
      setWalletModalStatus("Please sign the login message in your wallet.")
      const signInResult = await signInWithWallet(address)

      if (signInResult.needsRegistration) {
        setWalletModalMode("register")
        setWalletFlowStep("idle")
        setWalletModalStatus("Wallet conectada. Completa el registro para continuar.")
        setAuthStatus("Wallet connected. Complete your registration.")
        return
      }

      setWalletFlowStep("idle")
      setWalletModalStatus("Wallet conectada correctamente.")
      setTimeout(() => closeWalletModal(), 250)
    } catch (error) {
      setWalletFlowStep("idle")
      const message = getWalletErrorMessage(error, "Wallet connection failed.")
      setWalletModalStatus(message)
      setAuthStatus(message)
    } finally {
      setWalletBusy(false)
    }
  }

  const openWalletModal = () => {
    setWalletModalMode("connect")
    setWalletModalStatus("")
    setShowWalletModal(true)
    setTimeout(() => setModalVisible(true), 10)
  }

  const disconnectWallet = () => {
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
    setWalletModalMode("connect")
    setWalletModalStatus("")
    setWalletFlowStep("idle")
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
    if (!window.ethereum) return "No provider detected"
    if (window.ethereum.isMetaMask) return "MetaMask detected"
    if (window.ethereum.isPaliWallet) return "PaliWallet detected"
    return "Injected wallet detected"
  }

  const countWords = (text) =>
    String(text || "").trim().split(/\s+/).filter(Boolean).length

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
      setAuthStatus("Sign in with your wallet before uploading evidence.")
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
      setAuthStatus(error?.message || "No se pudo subir la evidencia.")
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

  const registerUser = async () => {
    if (!walletAddress) {
      setWalletModalStatus("Connect your wallet first.")
      return
    }

    if (!profile.name || !profile.avatar_url) {
      setWalletModalStatus("Name and avatar URL are required.")
      return
    }

    setWalletBusy(true)
    setWalletModalStatus("")
    try {
      const createdUser = await apiFetch("/users", {
        method: "POST",
        body: JSON.stringify({
          wallet_address: walletAddress,
          email: profile.email || null,
          name: profile.name,
          avatar_url: profile.avatar_url,
        }),
      })

      await signInWithWallet(walletAddress, createdUser?.name || profile.name)
      hydrateProfileFromUser(createdUser)
      setWalletModalStatus("Registro completado y sesión iniciada.")
      setTimeout(() => closeWalletModal(), 250)
    } catch (error) {
      if ((error.message || "").toLowerCase().includes("exists")) {
        try {
          await signInWithWallet(walletAddress, profile.name)
          setWalletModalStatus("Wallet ya registrada. Sesión iniciada.")
          setTimeout(() => closeWalletModal(), 250)
          return
        } catch {
          setWalletModalStatus("Wallet already registered. Sign in failed.")
        }
        return
      }
      const message = error?.message || "Registration failed."
      setWalletModalStatus(message)
      setAuthStatus(message)
    } finally {
      setWalletBusy(false)
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
        })
      }
    } catch (error) {
      setAdminStatus(error?.message || "No se pudo cargar la configuración de puntos.")
    } finally {
      setLoadingPointsConfig(false)
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
        }),
      })
      setNewEstablishment({ name: "", category: "", image_url: "" })
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
    })
    setAdminStatus("")
  }

  const cancelEditingEstablishment = () => {
    setEditingEstablishmentId("")
    setEditingEstablishment({ name: "", category: "", image_url: "" })
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

  const fetchEstablishments = async () => {
    try {
      const result = await apiFetch("/establishments")
      setEstablishments(result || [])
    } catch {
      setEstablishments([])
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
      error: "",
    })
    try {
      const review = await apiFetch(`/reviews/${reviewId}`)
      setSelectedReview(review)
      setActivePage("review-detail")
    } catch (error) {
      setAuthStatus(error?.message || "No se pudo cargar el detalle del review.")
    } finally {
      setLoadingSelectedReview(false)
      setLoadingReviewId("")
    }
  }

  const fetchReviewChainProof = async (review) => {
    if (!review?.review_hash) {
      setReviewChainInfo({
        loading: false,
        anchored: false,
        txHash: "",
        blockNumber: null,
        blockTimestamp: null,
        error: "Review hash not available.",
      })
      return
    }

    const providerCandidates = [readProvider, getWalletProvider()].filter(Boolean)
    if (providerCandidates.length === 0 || !CONTRACT_ADDRESS) {
      setReviewChainInfo({
        loading: false,
        anchored: false,
        txHash: "",
        blockNumber: null,
        blockTimestamp: null,
        error: "Blockchain provider not configured.",
      })
      return
    }

    setReviewChainInfo((prev) => ({ ...prev, loading: true, error: "" }))
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
          error: "",
        })
        return
      } catch (error) {
        lastError = error
      }
    }

    if (lastError) {
      setReviewChainInfo({
        loading: false,
        anchored: false,
        txHash: "",
        blockNumber: null,
        blockTimestamp: null,
        error: getChainProofErrorMessage(lastError),
      })
    }
  }

  const submitReview = async () => {
    if (!token) {
      setAuthStatus("Sign in with your wallet before posting a review.")
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
        purchase_url: reviewForm.purchase_url,
        tags,
        evidence_images: reviewForm.evidence_images,
      }

      const created = await apiFetch("/reviews", {
        method: "POST",
        body: JSON.stringify(body),
      })

      const reviewId = created.id
      const pointsAwarded = Number(created?.points_awarded ?? 0)

      // On-chain anchoring (user pays gas)
      if (reviewId) {
        const provider = getWalletProvider()
        if (!provider) {
          throw new Error("Wallet provider not found.")
        }
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

        await tx.wait()
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
      setAuthStatus("Review submitted and anchored on-chain.")
      fetchReviews(1)
      fetchLeaderboard(leaderMeta.page)
      setActivePage("reviews")
    } catch (error) {
      const message = getWalletErrorMessage(error, "Failed to submit review.")
      setAuthStatus(message)
      setReviewTx((prev) => ({
        ...prev,
        step: "error",
        message,
      }))
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
        walletUserName={walletUserName}
        isConnected={Boolean(walletAddress && token)}
        isAdmin={Boolean(walletAddress && token && isAdmin)}
        onWalletAction={handleWalletAction}
        onNavigate={setActivePage}
      />

      {showWalletModal && (
        <div className={`modal-overlay ${modalVisible ? "show" : ""}`} onClick={closeWalletModal}>
          <div className={`modal-card ${modalVisible ? "show" : ""}`} onClick={(event) => event.stopPropagation()}>
            <h3>{walletModalMode === "connect" ? "Connect a wallet" : "Complete your profile"}</h3>
            {walletModalMode === "connect" ? (
              <>
                <p>Select a wallet provider to continue.</p>
                <div className="pill" style={{ marginBottom: "12px" }}>{detectProvider()}</div>
                <div className="wallet-grid">
                  <button className="wallet-button" onClick={connectWallet} disabled={walletBusy}>
                    {walletBusy
                      ? walletFlowStep === "network"
                        ? "Switching network..."
                        : walletFlowStep === "accounts"
                          ? "Requesting account..."
                          : "Waiting signature..."
                      : "MetaMask"}
                  </button>
                  <button className="wallet-button" onClick={connectWallet} disabled={walletBusy}>
                    {walletBusy
                      ? walletFlowStep === "network"
                        ? "Switching network..."
                        : walletFlowStep === "accounts"
                          ? "Requesting account..."
                          : "Waiting signature..."
                      : "PaliWallet"}
                  </button>
                  <button className="wallet-button" onClick={connectWallet} disabled={walletBusy}>
                    {walletBusy
                      ? walletFlowStep === "network"
                        ? "Switching network..."
                        : walletFlowStep === "accounts"
                          ? "Requesting account..."
                          : "Waiting signature..."
                      : "Other Wallet"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p>Wallet connected. Finish registration to continue.</p>
                <div className="pill" style={{ marginBottom: "12px" }}>
                  {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : ""}
                </div>
                <div className="input-group">
                  <input
                    className="input"
                    placeholder="Name"
                    value={profile.name}
                    onChange={(event) => setProfile({ ...profile, name: event.target.value })}
                  />
                  <input
                    className="input"
                    placeholder="Email (optional)"
                    value={profile.email}
                    onChange={(event) => setProfile({ ...profile, email: event.target.value })}
                  />
                  <input
                    className="input"
                    placeholder="Avatar URL"
                    value={profile.avatar_url}
                    onChange={(event) => setProfile({ ...profile, avatar_url: event.target.value })}
                  />
                </div>
                <button className="primary-button" onClick={registerUser} disabled={walletBusy}>
                  {walletBusy ? "Registering..." : "Register and continue"}
                </button>
              </>
            )}
            {walletModalStatus && (
              <div style={{ marginTop: "12px", color: "#e85151" }}>
                {walletModalStatus}
              </div>
            )}
            <button className="ghost-button" style={{ marginTop: "16px" }} onClick={closeWalletModal}>
              Cancel
            </button>
          </div>
        </div>
      )}

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
                  <div style={{ display: "flex", gap: "8px" }}>
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
                {loadingReviews ? (
                  <p>Loading reviews...</p>
                ) : (
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
                              <div className="review-sub">{review.description}</div>
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
                            {loadingSelectedReview && loadingReviewId === review.id ? "Loading..." : "Watch Now"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <aside className="panel leaderboard-panel">
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
                <select
                  className="input"
                  value={reviewForm.establishment_id}
                  onChange={(event) =>
                    setReviewForm({ ...reviewForm, establishment_id: event.target.value })
                  }
                >
                  <option value="">Select establishment</option>
                  {establishments.map((est) => (
                    <option key={est.id} value={est.id}>
                      {est.name}
                    </option>
                  ))}
                </select>
                <div>
                  <input
                    className="input"
                    placeholder="Review title"
                    value={reviewForm.title}
                    onChange={(event) =>
                      setReviewForm({ ...reviewForm, title: event.target.value })
                    }
                  />
                  <div style={{ marginTop: "6px", fontSize: "12px", color: "#6b7280" }}>
                    {countWords(reviewForm.title)}/{MAX_REVIEW_TITLE_WORDS} palabras
                  </div>
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
                <div style={{ fontSize: "14px", color: "#374151" }}>
                  Stars: <strong>{reviewForm.stars}</strong>/5
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
                <input
                  className="input"
                  placeholder="Purchase URL"
                  value={reviewForm.purchase_url}
                  onChange={(event) =>
                    setReviewForm({ ...reviewForm, purchase_url: event.target.value })
                  }
                />
                <input
                  className="input"
                  placeholder="Tags (comma separated)"
                  value={reviewForm.tags}
                  onChange={(event) =>
                    setReviewForm({ ...reviewForm, tags: event.target.value })
                  }
                />
                <input
                  className="input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) {
                      uploadReviewEvidenceImage(file)
                    }
                    event.target.value = ""
                  }}
                  disabled={uploadingReviewEvidence || reviewForm.evidence_images.length >= MAX_REVIEW_EVIDENCE_IMAGES}
                />
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
              </div>
              <button className="primary-button" onClick={submitReview}>
                Submit review
              </button>
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
                      {!reviewChainInfo.loading && !reviewChainInfo.anchored && !reviewChainInfo.error && (
                        <div className="pill" style={{ width: "fit-content", color: "#92400e", background: "#fef3c7" }}>
                          Pending anchor or event not found yet
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
                <input
                  className="input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) {
                      uploadProfileAvatar(file)
                    }
                    event.target.value = ""
                  }}
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
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) {
                      uploadEstablishmentImage(file)
                    }
                    event.target.value = ""
                  }}
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
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={(event) => {
                              const file = event.target.files?.[0]
                              if (file) {
                                uploadEditingEstablishmentImage(file)
                              }
                              event.target.value = ""
                            }}
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
                  <input
                    className="input"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (file) {
                        uploadDefaultUserAvatar(file)
                      }
                      event.target.value = ""
                    }}
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
