'use client'

import { useState } from 'react'
import { Link2, Check } from 'lucide-react'

export function CopyLinkButton({ clientId }: { clientId: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    const url = `${window.location.origin}/solicitudes/${clientId}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-3 py-2 text-sm border border-border hover:border-muted rounded-lg transition-colors"
      style={{ color: copied ? '#34d399' : '#8b90a5' }}
      title="Copiar link para el cliente"
    >
      {copied ? <Check size={14} /> : <Link2 size={14} />}
      {copied ? 'Copiado' : 'Link cliente'}
    </button>
  )
}
