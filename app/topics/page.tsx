'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

type Topic = {
  id: string
  name: string
  parent_topic_id: string | null
}

export default function TopicsPage() {
  const router = useRouter()
  const [topics, setTopics] = useState<Topic[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [parentId, setParentId] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/'); return }
      fetchTopics(user.id)
    })
  }, [router])

  async function fetchTopics(userId: string) {
    const supabase = createClient()
    const { data } = await supabase
      .from('topics')
      .select('*')
      .eq('user_id', userId)
      .order('name')
    setTopics(data ?? [])
    setLoading(false)
  }

  async function handleAddTopic(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: topic, error: topicError } = await supabase
      .from('topics')
      .insert({
        user_id: user.id,
        name: name.trim(),
        parent_topic_id: parentId || null,
      })
      .select()
      .single()

    if (topicError) { setError(topicError.message); setSaving(false); return }

    setTopics(prev => [...prev, topic].sort((a, b) => a.name.localeCompare(b.name)))
    setName('')
    setParentId('')
    setShowForm(false)
    setSaving(false)
  }

  // Group topics: top-level first, then children under parents
  const topLevel = topics.filter(t => !t.parent_topic_id)
  const children = topics.filter(t => t.parent_topic_id)

  if (loading) return null

  return (
    <main className="min-h-screen px-6 py-10 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <button onClick={() => router.push('/dashboard')} className="opacity-50 hover:opacity-80 text-sm">
          ← Back
        </button>
        <h1 className="text-xl font-bold" style={{ color: '#4ade80' }}>Topics</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-sm font-semibold px-4 py-2 rounded-xl"
          style={{ backgroundColor: '#16a34a', color: '#fff' }}
        >
          {showForm ? 'Cancel' : '+ Add'}
        </button>
      </div>

      {/* Add topic form */}
      {showForm && (
        <form onSubmit={handleAddTopic} className="rounded-2xl p-5 mb-6" style={{ backgroundColor: '#1a2e1f' }}>
          <h2 className="font-semibold mb-4">New Topic</h2>
          <input
            type="text"
            placeholder="Topic name (e.g. Economics, Cloud)"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-green-500 mb-3"
          />

          {topLevel.length > 0 && (
            <div className="mb-4">
              <p className="text-sm opacity-50 mb-2">Parent topic (optional)</p>
              <select
                value={parentId}
                onChange={e => setParentId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white focus:outline-none focus:border-green-500"
              >
                <option value="">None (top-level)</option>
                {topLevel.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}

          {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 rounded-xl font-semibold disabled:opacity-50"
            style={{ backgroundColor: '#16a34a', color: '#fff' }}
          >
            {saving ? 'Saving...' : 'Save Topic'}
          </button>
        </form>
      )}

      {/* Topics list */}
      {topics.length === 0 ? (
        <div className="text-center opacity-40 mt-20">
          <p className="text-lg mb-2">No topics yet</p>
          <p className="text-sm">Tap "+ Add" to create your first topic</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {topLevel.map(topic => {
            const subs = children.filter(c => c.parent_topic_id === topic.id)
            return (
              <div key={topic.id} className="rounded-2xl p-5" style={{ backgroundColor: '#1a2e1f' }}>
                <p className="font-semibold">{topic.name}</p>
                {subs.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {subs.map(sub => (
                      <span
                        key={sub.id}
                        className="px-3 py-1 rounded-full text-xs"
                        style={{ backgroundColor: '#ffffff15' }}
                      >
                        {sub.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}
