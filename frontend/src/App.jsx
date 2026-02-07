import { useEffect, useState } from "react"
import { ethers } from "ethers"

import Header from "./components/Header"
import Footer from "./components/Footer"
import ReviewForm from "./components/ReviewForm"

const EXPECTED_CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID)

function App() {
  const [wrongNetwork, setWrongNetwork] = useState(false)

  useEffect(() => {
    const checkNetwork = async () => {
      if (!window.ethereum || !EXPECTED_CHAIN_ID) return

      const provider = new ethers.BrowserProvider(window.ethereum)
      const network = await provider.getNetwork()

      setWrongNetwork(Number(network.chainId) !== EXPECTED_CHAIN_ID)
    }

    checkNetwork()

    // Escuchar cambios de red en MetaMask
    if (window.ethereum) {
      window.ethereum.on("chainChanged", () => {
        window.location.reload()
      })
    }

    return () => {
      if (window.ethereum?.removeListener) {
        window.ethereum.removeListener("chainChanged", () => {})
      }
    }
  }, [])

  return (
    <>
      <Header />

      <main className="container my-5">
        {wrongNetwork && (
          <div className="alert alert-warning text-center">
            ⚠️ Conecta tu wallet a la red correcta para usar Syspoints
          </div>
        )}

        <div className="text-center mb-4">
          <h1 className="fw-bold">
            Syspoints es un sistema neutral de reseñas.
          </h1>
          <p className="text-muted">
            Tus reseñas ayudan a otros usuarios a tomar decisiones informadas.
          </p>
        </div>

        <ReviewForm />
      </main>

      <Footer />
    </>
  )
}

export default App