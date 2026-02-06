export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS
export const CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID)
export const RPC_URL = import.meta.env.VITE_RPC_URL
export const ABI = [
  "function addReview(string establishment, string review) public returns(uint256)",
  "event ReviewAdded(address indexed user, string establishment, uint256 points)"
]

