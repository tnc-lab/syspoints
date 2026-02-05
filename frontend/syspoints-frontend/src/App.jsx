import Header from "./components/Header"
import Footer from "./components/Footer"
import ReviewForm from "./components/ReviewForm"

import { useEffect } from "react"
import { ethers } from "ethers"

const EXPECTED_CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID)

function App() {

  useEffect(() => {
    const checkNetwork = async () => {
      if (!window.ethereum) return

      const provider = new ethers.BrowserProvider(window.ethereum)
      const network = await provider.getNetwork()

      if (Number(network.chainId) !== EXPECTED_CHAIN_ID) {
        alert("⚠️ Por favor conecta tu wallet a la nueva red")
      }
    }

    checkNetwork()
  }, [])

  return (
    <>
      <Header />

      <main className="container my-5">
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