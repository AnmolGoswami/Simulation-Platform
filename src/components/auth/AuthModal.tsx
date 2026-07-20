import React, { useState } from 'react'
import { auth } from '@/services/firebase'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth'
import { X, Mail, Lock, Loader2, AlertCircle } from 'lucide-react'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password)
      } else {
        await signInWithEmailAndPassword(auth, email, password)
      }
      onSuccess?.()
      onClose()
    } catch (err: any) {
      let msg = err.message
      if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        msg = 'Invalid email or password.'
      } else if (err.code === 'auth/weak-password') {
        msg = 'Password should be at least 6 characters.'
      } else if (err.code === 'auth/email-already-in-use') {
        msg = 'This email is already registered.'
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Invalid email format.'
      }
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-sm rounded-xl border border-surface-700 bg-surface-900 p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-text-muted hover:text-text-primary transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <h2 className="mb-1 text-lg font-bold text-text-primary">
          {isSignUp ? 'Create an Account' : 'Sign In'}
        </h2>
        <p className="mb-4 text-xs text-text-muted">
          {isSignUp
            ? 'Sign up to save and share your simulations.'
            : 'Sign in to access your saved simulations.'}
        </p>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-danger-500/30 bg-danger-500/10 p-3 text-xs text-danger-400">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-text-muted">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-border bg-surface-950 py-2 pl-9 pr-4 text-xs text-text-primary outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500 transition-shadow"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-text-muted">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-border bg-surface-950 py-2 pl-9 pr-4 text-xs text-text-primary outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500 transition-shadow"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-accent-500 py-2 text-xs font-semibold text-white hover:bg-accent-600 active:bg-accent-700 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Processing...
              </>
            ) : isSignUp ? (
              'Register'
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="mt-4 border-t border-surface-800 pt-4 text-center text-xs text-text-muted">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="font-semibold text-accent-400 hover:text-accent-300 hover:underline"
          >
            {isSignUp ? 'Sign In' : 'Create Account'}
          </button>
        </div>
      </div>
    </div>
  )
}
