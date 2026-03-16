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
  const [cardCounts, setCardCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [parentId, setParentId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Edit state
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null)
  const [editName, setEditName] = useState('')
  const [editParentId, setEditParentId] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/'); return }
      fetchData(user.id)
    })
  }, [router])

  async function fetchData(userId: string) {
    const supabase = createClient()
    const [{ data: topicsData }, { data: cardTopicsData }] = await Promise.all([
      supabase.from('topics').select('*').eq('user_id', userId).order('name'),
      supabase.from('card_topics').select('topic_id'),
    ])

    setTopics(topicsData ?? [])

    const counts: Record<string, number> = {}
    for (const ct of (cardTopicsData ?? [])) {
      counts[ct.topic_id] = (counts[ct.topic_id] ?? 0) + 1
    }
    setCardCounts(counts)
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
      .insert({ user_id: user.id, name: name.trim(), parent_topic_id: parentId || null })
      .select().single()

    if (topicError) { setError(topicError.message); setSaving(false); return }

    setTopics(prev => [...prev, topic].sort((a, b) => a.name.localeCompare(b.name)))
    setName('')
    setParentId('')
    setShowForm(false)
    setSaving(false)
  }

  function openEdit(topic: Topic) {
    setEditingTopic(topic)
    setEditName(topic.name)
    setEditParentId(topic.parent_topic_id ?? '')
  }

  async function handleEditTopic(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editingTopic) return
    setEditSaving(true)

    const supabase = createClient()
    await supabase.from('topics').update({
      name: editName.trim(),
      parent_topic_id: editParentId || null,
    }).eq('id', editingTopic.id)

    setTopics(prev =>
      prev.map(t => t.id === editingTopic.id
        ? { ...t, name: editName.trim(), parent_topic_id: editParentId || null }
        : t
      ).sort((a, b) => a.name.localeCompare(b.name))
    )
    setEditingTopic(null)
    setEditSaving(false)
  }

  async function handleDeleteTopic(topicId: string) {
    const supabase = createClient()
    await supabase.from('topics').delete().eq('id', topicId)
    setTopics(prev => prev.filter(t => t.id !== topicId))
  }

  const topLevel = topics.filter(t => !t.parent_topic_id)
  const children = topics.filter(t => t.parent_topic_id)

  if (loading) return null

  // Edit screen
  if (editingTopic) {
    const otherTopics = topLevel.filter(t => t.id !== editingTopic.id)
    return (
      <main className="min-h-screen px-6 py-10 max-w-md mx-auto">
        <div className="flex items-center justify-between mb-8">
          <button onClick={() => setEditingTopic(null)} className="opacity-50 hover:opacity-80 text-sm">← Cancel</button>
          <h1 className="text-xl font-bold" style={{ color: '#4ade80' }}>Edit Topic</h1>
          <div className="w-16" />
        </div>

        <form onSubmit={handleEditTopic} className="flex flex-col gap-4">
          <input type="text" value={editName} onChange={e => setEditName(e.target.value)} required
            placeholder="Topic name"
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-green-500" />

          {otherTopics.length > 0 && (
            <div>
              <p className="text-sm opacity-50 mb-2">Parent topic (optional)</p>
              <select value={editParentId} onChange={e => setEditParentId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white focus:outline-none focus:border-green-500">
                <option value="">None (top-level)</option>
                {otherTopics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}

          <button type="submit" disabled={editSaving}
            className="w-full py-3 rounded-xl font-semibold disabled:opacity-50"
            style={{ backgroundColor: '#16a34a', color: '#fff' }}>
            {editSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </main>
    )
  }

  return (
    <main className="min-h-screen px-6 py-10 max-w-md mx-auto">
      <div className="flex items-center justify-between mb-8">
        <button onClick={() => router.push('/dashboard')} className="opacity-50 hover:opacity-80 text-sm">← Back</button>
        <h1 className="text-xl font-bold" style={{ color: '#4ade80' }}>Topics</h1>
        <button onClick={() => setShowForm(!showForm)}
          className="text-sm font-semibold px-4 py-2 rounded-xl"
          style={{ backgroundColor: '#16a34a', color: '#fff' }}>
          {showForm ? 'Cancel' : '+ Add'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAddTopic} className="rounded-2xl p-5 mb-6" style={{ backgroundColor: '#1a2e1f' }}>
          <h2 className="font-semibold mb-4">New Topic</h2>
          <input type="text" placeholder="Topic name (e.g. Economics, Cloud)" value={name}
            onChange={e => setName(e.target.value)} required
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-green-500 mb-3" />

          {topLevel.length > 0 && (
            <div className="mb-4">
              <p className="text-sm opacity-50 mb-2">Parent topic (optional)</p>
              <select value={parentId} onChange={e => setParentId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white focus:outline-none focus:border-green-500">
                <option value="">None (top-level)</option>
                {topLevel.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}

          {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
          <button type="submit" disabled={saving}
            className="w-full py-3 rounded-xl font-semibold disabled:opacity-50"
            style={{ backgroundColor: '#16a34a', color: '#fff' }}>
            {saving ? 'Saving...' : 'Save Topic'}
          </button>
        </form>
      )}

      {topics.length === 0 ? (
        <div className="text-center opacity-40 mt-20">
          <p className="text-lg mb-2">No topics yet</p>
          <p className="text-sm">Tap "+ Add" to create your first topic</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {topLevel.map(topic => {
            const subs = children.filter(c => c.parent_topic_id === topic.id)
            const count = cardCounts[topic.id] ?? 0
            return (
              <div key={topic.id} className="rounded-2xl p-5" style={{ backgroundColor: '#1a2e1f' }}>
                <div className="flex items-center justify-between mb-1">
                  <button onClick={() => router.push(`/topics/${topic.id}`)} className="font-semibold hover:opacity-70 text-left" style={{ color: '#4ade80' }}>{topic.name}</button>
                  <span className="text-xs opacity-40">{count} {count === 1 ? 'card' : 'cards'}</span>
                </div>

                {subs.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2 mb-3">
                    {subs.map(sub => (
                      <div key={sub.id} className="flex items-center gap-1 px-2 py-1 rounded-full text-xs" style={{ backgroundColor: '#ffffff10' }}>
                        <span>{sub.name}</span>
                        <span className="opacity-40">· {cardCounts[sub.id] ?? 0}</span>
                        <button onClick={() => openEdit(sub)} className="ml-1 opacity-40 hover:opacity-80">✏️</button>
                        {confirmDeleteId === sub.id ? (
                          <>
                            <button onClick={() => handleDeleteTopic(sub.id)} className="text-red-400 hover:opacity-80">✓</button>
                            <button onClick={() => setConfirmDeleteId(null)} className="opacity-40 hover:opacity-80">✕</button>
                          </>
                        ) : (
                          <button onClick={() => setConfirmDeleteId(sub.id)} className="opacity-40 hover:opacity-80">✕</button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2 mt-2">
                  <button onClick={() => openEdit(topic)}
                    className="px-4 py-1.5 rounded-xl text-sm"
                    style={{ backgroundColor: '#ffffff10' }}>Edit</button>
                  {confirmDeleteId === topic.id ? (
                    <>
                      <button onClick={() => handleDeleteTopic(topic.id)}
                        className="px-4 py-1.5 rounded-xl text-sm"
                        style={{ backgroundColor: '#3d1a1a', color: '#f87171' }}>Confirm</button>
                      <button onClick={() => setConfirmDeleteId(null)}
                        className="px-4 py-1.5 rounded-xl text-sm"
                        style={{ backgroundColor: '#ffffff10' }}>Cancel</button>
                    </>
                  ) : (
                    <button onClick={() => setConfirmDeleteId(topic.id)}
                      className="px-4 py-1.5 rounded-xl text-sm"
                      style={{ backgroundColor: '#3d1a1a', color: '#f87171' }}>Delete</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}
