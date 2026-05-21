'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Email o contraseña incorrectos.')
      setLoading(false)
      return
    }

    router.push('/home')
    router.refresh()
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name: name || email.split('@')[0] } },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSuccess('Cuenta creada. Ya podés iniciar sesión.')
    setMode('login')
    setPassword('')
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-yesica/20 border border-yesica/30 mb-4">
            <span className="font-mono font-bold text-yesica text-xl">AH</span>
          </div>
          <h1 className="text-text text-2xl font-bold">AgencyHub</h1>
          <p className="text-muted text-sm mt-1">Centro de operaciones</p>
        </div>

        <form
          onSubmit={mode === 'login' ? handleLogin : handleSignup}
          className="bg-surface border border-border rounded-2xl p-8 space-y-5"
        >
          <div className="flex rounded-lg border border-border overflow-hidden text-sm font-medium">
            <button
              type="button"
              onClick={() => { setMode('login'); setError(null); setSuccess(null) }}
              className={`flex-1 py-2 transition-colors ${mode === 'login' ? 'bg-yesica/20 text-yesica' : 'text-muted hover:text-text'}`}
            >
              Ingresar
            </button>
            <button
              type="button"
              onClick={() => { setMode('signup'); setError(null); setSuccess(null) }}
              className={`flex-1 py-2 transition-colors ${mode === 'signup' ? 'bg-yesica/20 text-yesica' : 'text-muted hover:text-text'}`}
            >
              Crear cuenta
            </button>
          </div>

          {mode === 'signup' && (
            <div>
              <label className="block text-sm font-medium text-text mb-1.5">Nombre</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tu nombre"
                className="w-full px-4 py-2.5 text-sm rounded-lg"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-text mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="tu@agencia.com"
              className="w-full px-4 py-2.5 text-sm rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-1.5">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full px-4 py-2.5 text-sm rounded-lg"
            />
          </div>

          {error && (
            <p className="text-danger text-sm text-center bg-danger/10 py-2 px-3 rounded-lg border border-danger/20">
              {error}
            </p>
          )}
          {success && (
            <p className="text-success text-sm text-center bg-success/10 py-2 px-3 rounded-lg border border-success/20">
              {success}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-yesica hover:bg-yesica/80 text-bg font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {loading ? '...' : mode === 'login' ? 'Ingresar' : 'Crear cuenta'}
          </button>
        </form>
      </div>
    </div>
  )
}
