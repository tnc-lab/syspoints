export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS
export const CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID)
export const RPC_URL = import.meta.env.VITE_RPC_URL
export const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3000"
export const EXPLORER_TX_BASE_URL = import.meta.env.VITE_EXPLORER_TX_BASE_URL || "https://explorer-pob.dev11.top/tx/"
export const ABI = [
  "function anchorReview(address user, bytes32 reviewHash, bytes32 establishmentId) external",
  "function anchorApprovedReview(address user, bytes32 reviewHash, bytes32 establishmentId) external",
  "function approveReview(bytes32 reviewHash) external",
  "function rejectReview(bytes32 reviewHash) external",
  "function executeApprovedReviewEffect(bytes32 reviewHash) external returns (bool)",
  "function getReviewStatus(bytes32 reviewHash) external view returns (uint8)",
  "function isReviewApproved(bytes32 reviewHash) external view returns (bool)",
  "function getReviewAnchor(bytes32 reviewHash) external view returns (address user, bytes32 establishmentId, uint256 anchoredAt, uint256 reviewedAt, uint8 status, bool executed)",
  "event ReviewAnchored(address indexed user, bytes32 indexed reviewHash, bytes32 indexed establishmentId, uint256 timestamp)",
  "event ReviewApproved(bytes32 indexed reviewHash, address indexed reviewer, uint256 timestamp)",
  "event ReviewRejected(bytes32 indexed reviewHash, address indexed reviewer, uint256 timestamp)",
  "event ReviewEffectExecuted(bytes32 indexed reviewHash, address indexed executor, uint256 timestamp)"
]
