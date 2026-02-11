export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS
export const CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID)
export const RPC_URL = import.meta.env.VITE_RPC_URL
export const ABI = [
  "function anchorReview(address user, bytes32 reviewHash, bytes32 establishmentId) external",
  "event ReviewAnchored(address indexed user, bytes32 indexed reviewHash, bytes32 indexed establishmentId, uint256 timestamp)"
]
