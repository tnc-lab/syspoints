import Header from "./components/Header"
import Footer from "./components/Footer"
import ReviewForm from "./components/ReviewForm"

function App() {
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