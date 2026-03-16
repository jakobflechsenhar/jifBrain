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

  // New card form state
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [selectedTopics, setSelectedTopics] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/'); return }
      fetchData(user.id)
    })
  }, [router])

  async function fetchData(userId: string) {
    const supabase = createClient()
    const [{ data: cardsData }, { data: topicsData }] = await Promise.all([
      supabase.from('cards').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('topics').select('*').eq('user_id', userId).order('name'),
    ])
    setCards(cardsData ?? [])
    setTopics(topicsData ?? [])
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
    setQuestion('')
    setAnswer('')
    setSelectedTopics([])
    setShowForm(false)
    setSaving(false)
  }

  function toggleTopic(id: string) {
    setSelectedTopics(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    )
  }

  if (loading) return null

  return (
    <main className="min-h-screen px-6 py-10 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <button onClick={() => router.push('/dashboard')} className="opacity-50 hover:opacity-80 text-sm">
          ← Back
        </button>
        <h1 className="text-xl font-bold" style={{ color: '#4ade80' }}>My Cards</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-sm font-semibold px-4 py-2 rounded-xl"
          style={{ backgroundColor: '#16a34a', color: '#fff' }}
        >
          {showForm ? 'Cancel' : '+ Add'}
        </button>
      </div>

      {/* Add card form */}
      {showForm && (
        <form onSubmit={handleAddCard} className="rounded-2xl p-5 mb-6" style={{ backgroundColor: '#1a2e1f' }}>
          <h2 className="font-semibold mb-4">New Card</h2>
          <textarea
            placeholder="Question"
            value={question}
            onChange={e => setQuestion(e.target.value)}
            required
            rows={2}
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-green-500 resize-none mb-3"
          />
          <textarea
            placeholder="Answer"
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            required
            rows={3}
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-green-500 resize-none mb-3"
          />

          {topics.length > 0 && (
            <div className="mb-4">
              <p className="text-sm opacity-50 mb-2">Topics</p>
              <div className="flex flex-wrap gap-2">
                {topics.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTopic(t.id)}
                    className="px-3 py-1 rounded-full text-sm transition-colors"
                    style={{
                      backgroundColor: selectedTopics.includes(t.id) ? '#16a34a' : '#ffffff15',
                      color: '#fff'
                    }}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 rounded-xl font-semibold disabled:opacity-50"
            style={{ backgroundColor: '#16a34a', color: '#fff' }}
          >
            {saving ? 'Saving...' : 'Save Card'}
          </button>
        </form>
      )}

      {/* Cards list */}
      {cards.length === 0 ? (
        <div className="text-center opacity-40 mt-20">
          <p className="text-lg mb-2">No cards yet</p>
          <p className="text-sm">Tap "+ Add" to create your first card</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {cards.map(card => (
            <div key={card.id} className="rounded-2xl p-5" style={{ backgroundColor: '#1a2e1f' }}>
              <p className="font-medium mb-2">{card.question}</p>
              <p className="text-sm opacity-50">{card.answer}</p>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
