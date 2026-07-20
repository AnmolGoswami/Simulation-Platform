import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'

const HomePage = lazy(() =>
  import('@/pages/HomePage').then((m) => ({ default: m.HomePage })),
)
const SimulatorPage = lazy(() =>
  import('@/pages/SimulatorPage').then((m) => ({ default: m.SimulatorPage })),
)

function PageLoader() {
  return (
    <div className="flex h-full items-center justify-center bg-surface-950">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
        <p className="text-sm text-text-muted">Loading...</p>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/simulator" element={<SimulatorPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
