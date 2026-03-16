'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'

type Topic = {
  id: string
  name: string
  parent_topic_id: string | null
}

type Card = {
  id: string
  question: string
  answer: string
}

export default function TopicDetailPage() {
  const router = useRouter()
  const params = useParams()
  const topicId = params.id as string

  const [topic, setTopic] = useState<Topic | null>(null)
  const [subtopics, setSubtopics] = useState<Topic[]>([])
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedCard, setExpandedCard] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/'); return }
      fetchData(user.id)
    })
  }, [router, topicId])

  async function fetchData(userId: string) {
    const supabase = createClient()

    const [{ data: topicData }, { data: allTopics }, { data: cardTopics }] = await Promise.all([
      supabase.from('topics').select('*').eq('id', topicId).single(),
      supabase.from('topics').select('*').eq('user_id', userId).eq('parent_topic_id', topicId).order('name'),
      supabase.from('card_topics').select('card_id').eq('topic_id', topicId),
    ])

    setTopic(topicData)
    setSubtopics(allTopics ?? [])

    const cardIds = (cardTopics ?? []).map(ct => ct.card_id)
    if (cardIds.length > 0) {
      const { data: cardsData } = await supabase
        .from('cards')
        .select('id, question, answer')
        .in('id', cardIds)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      setCards(cardsData ?? [])
    }

    setLoading(false)
  }

  if (loading) return null
  if (!topic) return null

  return (
    <main className="min-h-screen px-6 py-10 max-w-md mx-auto">
      <div className="flex items-center justify-between mb-8">
        <button onClick={() => router.push('/topics')} className="opacity-50 hover:opacity-80 text-sm">
          ← Back
        </button>
        <h1 className="text-xl font-bold" style={{ color: '#4ade80' }}>{topic.name}</h1>
        <div className="w-10" />
      </div>

      {/* Subtopics */}
      {subtopics.length > 0 && (
        <div className="mb-6">
          <p className="text-xs opacity-40 uppercase tracking-widest mb-3">Subtopics</p>
          <div className="flex flex-col gap-2">
            {subtopics.map(sub => (
              <button
                key={sub.id}
                onClick={() => router.push(`/topics/${sub.id}`)}
                className="w-full text-left px-5 py-3 rounded-2xl transition-opacity hover:opacity-80"
                style={{ backgroundColor: '#1a2e1f' }}
              >
                <p className="font-medium">{sub.name}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Cards */}
      <div>
        <p className="text-xs opacity-40 uppercase tracking-widest mb-3">
          {cards.length} {cards.length === 1 ? 'Card' : 'Cards'}
        </p>
        {cards.length === 0 ? (
          <p className="text-sm opacity-30 text-center mt-10">No cards in this topic yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {cards.map(card => (
              <div
                key={card.id}
                className="rounded-2xl p-5 cursor-pointer"
                style={{ backgroundColor: '#1a2e1f' }}
                onClick={() => setExpandedCard(expandedCard === card.id ? null : card.id)}
              >
                <p className="font-medium">{card.question}</p>
                {expandedCard === card.id && (
                  <p className="text-sm opacity-60 mt-3 pt-3 border-t border-white/10">{card.answer}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
