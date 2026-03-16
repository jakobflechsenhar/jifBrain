'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

type Card = {
  id: string
  question: string
  answer: string
  created_at: string
}

type Topic = {
  id: string
  name: string
}

export default function CardsPage() {
  const router = useRouter()
  const [cards, setCards] = useState<Card[]>([])
  const [topics, setTopics] = useState<Topic[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  // Add form
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [selectedTopics, setSelectedTopics] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Delete confirmation
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // Edit state
  const [editingCard, setEditingCard] = useState<Card | null>(null)
  const [editQuestion, setEditQuestion] = useState('')
  const [editAnswer, setEditAnswer] = useState('')
  const [editTopics, setEditTopics] = useState<string[]>([])
  const [editSaving, setEditSaving] = useState(false)

  // Card topics map: cardId -> topicId[]
  const [cardTopicsMap, setCardTopicsMap] = useState<Record<string, string[]>>({})

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/'); return }
      fetchData(user.id)
    })
  }, [router])

  async function fetchData(userId: string) {
    const supabase = createClient()
    const [{ data: cardsData }, { data: topicsData }, { data: cardTopicsData }] = await Promise.all([
      supabase.from('cards').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('topics').select('*').eq('user_id', userId).order('name'),
      supabase.from('card_topics').select('card_id, topic_id'),
    ])
    setCards(cardsData ?? [])
    setTopics(topicsData ?? [])

    const map: Record<string, string[]> = {}
    for (const ct of (cardTopicsData ?? [])) {
      if (!map[ct.card_id]) map[ct.card_id] = []
      map[ct.card_id].push(ct.topic_id)
    }
    setCardTopicsMap(map)
    setLoading(false)
  }

  async function handleAddCard(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: card, error: cardError } = await supabase
      .from('cards')
      .insert({ user_id: user.id, question, answer })
      .select()
      .single()

    if (cardError) { setError(cardError.message); setSaving(false); return }

    if (selectedTopics.length > 0) {
      await supabase.from('card_topics').insert(
        selectedTopics.map(topicId => ({ card_id: card.id, topic_id: topicId }))
      )
    }

    setCards(prev => [card, ...prev])
    setCardTopicsMap(prev => ({ ...prev, [card.id]: selectedTopics }))
    setQuestion('')
    setAnswer('')
    setSelectedTopics([])
    setShowForm(false)
    setSaving(false)
  }

  function openEdit(card: Card) {
    setEditingCard(card)
    setEditQuestion(card.question)
    setEditAnswer(card.answer)
    setEditTopics(cardTopicsMap[card.id] ?? [])
  }

  async function handleEditCard(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editingCard) return
    setEditSaving(true)

    const supabase = createClient()
    await supabase.from('cards').update({ question: editQuestion, answer: editAnswer }).eq('id', editingCard.id)

    // Replace card_topics
    await supabase.from('card_topics').delete().eq('card_id', editingCard.id)
    if (editTopics.length > 0) {
      await supabase.from('card_topics').insert(
        editTopics.map(topicId => ({ card_id: editingCard.id, topic_id: topicId }))
      )
    }

    setCards(prev => prev.map(c => c.id === editingCard.id ? { ...c, question: editQuestion, answer: editAnswer } : c))
    setCardTopicsMap(prev => ({ ...prev, [editingCard.id]: editTopics }))
    setEditingCard(null)
    setEditSaving(false)
  }

  async function handleDeleteCard(cardId: string) {
    const supabase = createClient()
    await supabase.from('cards').delete().eq('id', cardId)
    setCards(prev => prev.filter(c => c.id !== cardId))
    setCardTopicsMap(prev => { const next = { ...prev }; delete next[cardId]; return next })
  }

  function toggleTopic(id: string) {
    setSelectedTopics(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id])
  }

  function toggleEditTopic(id: string) {
    setEditTopics(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id])
  }

  if (loading) return null

  // Edit modal
  if (editingCard) {
    return (
      <main className="min-h-screen px-6 py-10 max-w-md mx-auto">
        <div className="flex items-center justify-between mb-8">
          <button onClick={() => setEditingCard(null)} className="opacity-50 hover:opacity-80 text-sm">← Cancel</button>
          <h1 className="text-xl font-bold" style={{ color: '#4ade80' }}>Edit Card</h1>
          <div className="w-16" />
        </div>

        <form onSubmit={handleEditCard} className="flex flex-col gap-4">
          <textarea
            value={editQuestion}
            onChange={e => setEditQuestion(e.target.value)}
            required
            rows={2}
            placeholder="Question"
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-green-500 resize-none"
          />
          <textarea
            value={editAnswer}
            onChange={e => setEditAnswer(e.target.value)}
            required
            rows={3}
            placeholder="Answer"
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-green-500 resize-none"
          />

          {topics.length > 0 && (
            <div>
              <p className="text-sm opacity-50 mb-2">Topics</p>
              <div className="flex flex-wrap gap-2">
                {topics.map(t => (
                  <button key={t.id} type="button" onClick={() => toggleEditTopic(t.id)}
                    className="px-3 py-1 rounded-full text-sm"
                    style={{ backgroundColor: editTopics.includes(t.id) ? '#16a34a' : '#ffffff15', color: '#fff' }}>
                    {t.name}
                  </button>
                ))}
              </div>
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
        <h1 className="text-xl font-bold" style={{ color: '#4ade80' }}>My Cards</h1>
        <button onClick={() => setShowForm(!showForm)}
          className="text-sm font-semibold px-4 py-2 rounded-xl"
          style={{ backgroundColor: '#16a34a', color: '#fff' }}>
          {showForm ? 'Cancel' : '+ Add'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAddCard} className="rounded-2xl p-5 mb-6" style={{ backgroundColor: '#1a2e1f' }}>
          <h2 className="font-semibold mb-4">New Card</h2>
          <textarea placeholder="Question" value={question} onChange={e => setQuestion(e.target.value)}
            required rows={2}
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-green-500 resize-none mb-3" />
          <textarea placeholder="Answer" value={answer} onChange={e => setAnswer(e.target.value)}
            required rows={3}
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-green-500 resize-none mb-3" />

          {topics.length > 0 && (
            <div className="mb-4">
              <p className="text-sm opacity-50 mb-2">Topics</p>
              <div className="flex flex-wrap gap-2">
                {topics.map(t => (
                  <button key={t.id} type="button" onClick={() => toggleTopic(t.id)}
                    className="px-3 py-1 rounded-full text-sm"
                    style={{ backgroundColor: selectedTopics.includes(t.id) ? '#16a34a' : '#ffffff15', color: '#fff' }}>
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
          <button type="submit" disabled={saving}
            className="w-full py-3 rounded-xl font-semibold disabled:opacity-50"
            style={{ backgroundColor: '#16a34a', color: '#fff' }}>
            {saving ? 'Saving...' : 'Save Card'}
          </button>
        </form>
      )}

      {cards.length === 0 ? (
        <div className="text-center opacity-40 mt-20">
          <p className="text-lg mb-2">No cards yet</p>
          <p className="text-sm">Tap "+ Add" to create your first card</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {cards.map(card => {
            const topicNames = (cardTopicsMap[card.id] ?? [])
              .map(tid => topics.find(t => t.id === tid)?.name)
              .filter(Boolean)
            return (
              <div key={card.id} className="rounded-2xl p-5" style={{ backgroundColor: '#1a2e1f' }}>
                <p className="font-medium mb-1">{card.question}</p>
                <p className="text-sm opacity-50 mb-3">{card.answer}</p>
                {topicNames.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {topicNames.map(name => (
                      <span key={name} className="px-2 py-0.5 rounded-full text-xs" style={{ backgroundColor: '#ffffff15' }}>{name}</span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <button onClick={() => openEdit(card)}
                    className="px-4 py-1.5 rounded-xl text-sm"
                    style={{ backgroundColor: '#ffffff10' }}>
                    Edit
                  </button>
                  {confirmDeleteId === card.id ? (
                    <>
                      <button onClick={() => handleDeleteCard(card.id)}
                        className="px-4 py-1.5 rounded-xl text-sm"
                        style={{ backgroundColor: '#3d1a1a', color: '#f87171' }}>
                        Confirm
                      </button>
                      <button onClick={() => setConfirmDeleteId(null)}
                        className="px-4 py-1.5 rounded-xl text-sm"
                        style={{ backgroundColor: '#ffffff10' }}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button onClick={() => setConfirmDeleteId(card.id)}
                      className="px-4 py-1.5 rounded-xl text-sm"
                      style={{ backgroundColor: '#3d1a1a', color: '#f87171' }}>
                      Delete
                    </button>
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
