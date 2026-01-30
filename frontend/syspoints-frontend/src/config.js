export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS

export const ABI = [
  "function addReview(string establishment, string review) public returns(uint256)",
  "event ReviewAdded(address indexed user, string establishment, uint256 points)"
]