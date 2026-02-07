import { useState } from "react"
import { ethers } from "ethers"
import { CONTRACT_ADDRESS, ABI, CHAIN_ID, RPC_URL } from "../config"

export default function ReviewForm() {
  const [establishment, setEstablishment] = useState("")
  const [review, setReview] = useState("")
  const [status, setStatus] = useState("")
  const [txHash, setTxHash] = useState("")
  const [points, setPoints] = useState(null)
  const [loading, setLoading] = useState(false)

  // 👉 Asegura que MetaMask esté en Syscoin Devnet
  const ensureNetwork = async () => {
    const hexChainId = `0x${Number(CHAIN_ID).toString(16)}`

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: hexChainId }],
      })
    } catch (err) {
      if (err.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: hexChainId,
              chainName: "Syscoin Devnet",
              rpcUrls: [RPC_URL],
              nativeCurrency: {
                name: "tSYS",
                symbol: "tSYS",
                decimals: 18,
              },
              blockExplorerUrls: [],
            },
          ],
        })
      } else {
        throw err
      }
    }
  }

  const submitReview = async (e) => {
    e.preventDefault()

    try {
      if (!window.ethereum) {
        setStatus("❌ MetaMask not detected")
        return
      }

      setLoading(true)
      setStatus("⏳ Checking network...")

      // 1️⃣ Asegurar red
      await ensureNetwork()

      // 2️⃣ Crear provider DESPUÉS del switch
      const provider = new ethers.BrowserProvider(window.ethereum)
      const network = await provider.getNetwork()

      if (network.chainId !== BigInt(CHAIN_ID)) {
        setStatus("❌ Please switch MetaMask to Syscoin Devnet")
        setLoading(false)
        return
      }

      setStatus("⏳ Waiting for wallet confirmation...")

      // 3️⃣ Interactuar con el contrato
      const signer = await provider.getSigner()
      const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer)

      const tx = await contract.addReview(establishment, review)
      setTxHash(tx.hash)

      setStatus("⛏️ Transaction sent. Waiting for confirmation...")

      const receipt = await tx.wait()

      const event = receipt.logs
        .map(log => {
          try {
            return contract.interface.parseLog(log)
          } catch {
            return null
          }
        })
        .find(e => e && e.name === "ReviewAdded")

      if (event) {
        setPoints(event.args.points.toString())
      }

      setStatus("✅ Review stored on Syscoin blockchain")
      setEstablishment("")
      setReview("")
    } catch (error) {
      console.error(error)
      setStatus("❌ Transaction failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="row justify-content-center">
      <div className="col-md-6">
        <div className="card shadow-lg">
          <div className="card-body">
            <h5 className="card-title text-center mb-3">
              Deja una reseña y gana Syspoints
            </h5>

            <form onSubmit={submitReview}>
              <div className="mb-3">
                <label className="form-label">Tienda y/o establecimiento</label>
                <input
                  className="form-control"
                  value={establishment}
                  onChange={e => setEstablishment(e.target.value)}
                  placeholder="Falabella, MercadoLibre..."
                  required
                  disabled={loading}
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Reseña</label>
                <textarea
                  className="form-control"
                  rows="4"
                  value={review}
                  onChange={e => setReview(e.target.value)}
                  placeholder="Describe tu experiencia..."
                  required
                  disabled={loading}
                />
              </div>

              <button className="btn btn-primary w-100" disabled={loading}>
                {loading ? "Processing..." : "Hecho"}
              </button>
            </form>

            {status && (
              <div className="alert alert-info mt-3 text-center">
                {status}
              </div>
            )}

            {txHash && (
              <div className="small text-center text-break mt-2">
                <strong>Transaction:</strong><br />
                {txHash}
              </div>
            )}

            {points && (
              <div className="alert alert-success mt-3 text-center">
                ⭐ Ganaste <strong>{points}</strong> Syspoints
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
