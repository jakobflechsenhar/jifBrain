'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function Dashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push('/')
      else setLoading(false)
    })
  }, [router])

  if (loading) return null

  return (
    <main className="min-h-screen px-6 py-10 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <h1 className="text-2xl font-bold" style={{ color: '#4ade80' }}>MemoryBase</h1>
        <button
          onClick={async () => {
            const supabase = createClient()
            await supabase.auth.signOut()
            window.location.href = '/'
          }}
          className="text-sm opacity-40 hover:opacity-70 transition-opacity"
        >
          Sign out
        </button>
      </div>

      {/* Streak card */}
      <div className="rounded-2xl p-6 mb-4" style={{ backgroundColor: '#1a2e1f' }}>
        <div className="flex items-center gap-3 mb-1">
          <span className="text-3xl">🔥</span>
          <span className="text-4xl font-bold">0</span>
          <span className="text-lg opacity-60">day streak</span>
        </div>
        <p className="text-sm opacity-40 mt-2">Complete a study session to start your streak</p>
      </div>

      {/* Today's stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="rounded-2xl p-5" style={{ backgroundColor: '#1a2e1f' }}>
          <p className="text-3xl font-bold">0</p>
          <p className="text-sm opacity-50 mt-1">cards today</p>
        </div>
        <div className="rounded-2xl p-5" style={{ backgroundColor: '#1a2e1f' }}>
          <p className="text-3xl font-bold">0m</p>
          <p className="text-sm opacity-50 mt-1">time today</p>
        </div>
      </div>

      {/* Study Now button */}
      <button
        className="w-full py-4 rounded-2xl text-lg font-semibold mb-6 transition-opacity hover:opacity-90"
        style={{ backgroundColor: '#16a34a', color: '#fff' }}
      >
        Study Now
      </button>

      {/* Navigation */}
      <div className="grid grid-cols-2 gap-3">
        <button className="rounded-2xl p-5 text-left transition-opacity hover:opacity-80" style={{ backgroundColor: '#1a2e1f' }}>
          <p className="text-xl mb-1">📚</p>
          <p className="font-semibold">My Cards</p>
          <p className="text-sm opacity-40">Add & manage</p>
        </button>
        <button className="rounded-2xl p-5 text-left transition-opacity hover:opacity-80" style={{ backgroundColor: '#1a2e1f' }}>
          <p className="text-xl mb-1">🏷️</p>
          <p className="font-semibold">Topics</p>
          <p className="text-sm opacity-40">Browse & filter</p>
        </button>
      </div>
    </main>
  )
}
