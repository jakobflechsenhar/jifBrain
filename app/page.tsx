'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

type Mode = 'login' | 'signup' | 'reset'

export default function AuthPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<Mode>('login')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setMessage(error.message)
      else setMessage('Check your email to confirm your account.')
    } else if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setMessage(error.message)
      else router.push('/dashboard')
    } else if (mode === 'reset') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) setMessage(error.message)
      else setMessage('Password reset email sent — check your inbox.')
    }

    setLoading(false)
  }

  function switchMode(next: Mode) {
    setMode(next)
    setMessage('')
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold text-center mb-2" style={{ color: '#4ade80' }}>
          jifBrain
        </h1>
        <p className="text-center text-sm mb-8 opacity-60">
          {mode === 'signup' ? 'Create your account' : mode === 'reset' ? 'Reset your password' : 'Welcome back'}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-green-500"
          />
          {mode !== 'reset' && (
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-green-500"
            />
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg font-semibold transition-opacity disabled:opacity-50"
            style={{ backgroundColor: '#16a34a', color: '#fff' }}
          >
            {loading ? '...' : mode === 'signup' ? 'Sign Up' : mode === 'reset' ? 'Send Reset Email' : 'Log In'}
          </button>
        </form>

        {message && (
          <p className="mt-4 text-center text-sm opacity-70">{message}</p>
        )}

        <div className="mt-6 text-center text-sm opacity-50 flex flex-col gap-2">
          {mode === 'login' && (
            <>
              <p>
                {"Don't have an account?"}{' '}
                <button onClick={() => switchMode('signup')} className="underline" style={{ color: '#4ade80' }}>Sign up</button>
              </p>
              <p>
                Forgot your password?{' '}
                <button onClick={() => switchMode('reset')} className="underline" style={{ color: '#4ade80' }}>Reset it</button>
              </p>
            </>
          )}
          {mode !== 'login' && (
            <p>
              <button onClick={() => switchMode('login')} className="underline" style={{ color: '#4ade80' }}>Back to login</button>
            </p>
          )}
        </div>
      </div>
    </main>
  )
}
