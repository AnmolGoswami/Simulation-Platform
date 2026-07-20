import { useState } from 'react'
import { X, Copy, Check, ExternalLink } from 'lucide-react'

interface ShareModalProps {
  isOpen: boolean
  onClose: () => void
  shareUrl: string
}

export function ShareModal({ isOpen, onClose, shareUrl }: ShareModalProps) {
  const [copied, setCopied] = useState(false)

  if (!isOpen) return null

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy to clipboard', err)
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

        <h2 className="mb-1 text-lg font-bold text-text-primary">Share Simulation</h2>
        <p className="mb-4 text-xs text-text-muted">
          Anyone with this link can view and run your simulated circuit in real-time.
        </p>

        <div className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-950 p-1.5">
          <input
            type="text"
            readOnly
            value={shareUrl}
            className="flex-1 bg-transparent px-2.5 py-1 text-xs text-text-primary outline-none"
          />
          <button
            onClick={handleCopy}
            className="flex h-8 w-8 items-center justify-center rounded-md bg-surface-800 text-text-muted hover:bg-surface-750 hover:text-text-primary transition-colors"
            title="Copy Link"
          >
            {copied ? <Check className="h-4 w-4 text-success-400" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>

        <div className="mt-4 flex justify-end gap-2 border-t border-surface-800 pt-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-border hover:bg-surface-800 text-text-secondary px-4 py-2 text-xs font-semibold transition-colors"
          >
            Close
          </button>
          <a
            href={shareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent-500 hover:bg-accent-600 active:bg-accent-700 text-white px-4 py-2 text-xs font-semibold transition-colors"
          >
            Open Link
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  )
}
