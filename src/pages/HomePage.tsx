import { Link } from 'react-router-dom'
import { Plane, Cpu, Zap, ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'

export function HomePage() {
  return (
    <div className="flex h-full flex-col bg-surface-950">
      <div className="flex flex-1 flex-col items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-2xl text-center"
        >
          <div className="mb-6 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-500/20">
              <Plane className="h-8 w-8 text-accent-400" />
            </div>
          </div>

          <h1 className="mb-3 text-3xl font-bold text-text-primary">
            Aircraft Fault-Tolerant System Simulator
          </h1>
          <p className="mb-8 text-text-secondary">
            Browser-based electronics simulator for prototyping Arduino and ESP32 circuits.
            Design, wire, and simulate your fault-tolerant aircraft systems — completely offline.
          </p>

          <Link
            to="/simulator"
            className="inline-flex items-center gap-2 rounded-lg bg-accent-500 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-600"
          >
            Open Simulator
            <ArrowRight className="h-4 w-4" />
          </Link>

          <div className="mt-12 grid grid-cols-3 gap-4">
            {[
              { icon: Cpu, title: 'ESP32 & Arduino', desc: 'Full board support' },
              { icon: Zap, title: 'Live Simulation', desc: 'Real-time component behavior' },
              { icon: Plane, title: 'Offline First', desc: 'No backend required' },
            ].map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="rounded-xl border border-border bg-surface-900 p-4 text-left"
              >
                <Icon className="mb-2 h-5 w-5 text-accent-400" />
                <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
                <p className="text-xs text-text-muted">{desc}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      <footer className="border-t border-border py-4 text-center text-xs text-text-muted">
        Module 1 — Dashboard Layout · Component Library · Workspace · Breadboard · Monaco Editor
      </footer>
    </div>
  )
}
