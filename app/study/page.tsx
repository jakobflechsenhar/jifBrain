'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { sm2 } from '@/lib/sm2'

type Card = {
  id: string
  question: string
  answer: string
  ease_factor: number
  interval_days: number
  repetitions: number
}

export default function StudyPage() {
  const router = useRouter()
  const [cards, setCards] = useState<Card[]>([])
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [loading, setLoading] = useState(true)
  const [done, setDone] = useState(false)
  const [reviewed, setReviewed] = useState(0)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/'); return }
      fetchDueCards(user.id)
    })
  }, [router])

  async function fetchDueCards(userId: string) {
    const supabase = createClient()
    const now = new Date().toISOString()
    const { data } = await supabase
      .from('cards')
      .select('id, question, answer, ease_factor, interval_days, repetitions')
      .eq('user_id', userId)
      .lte('next_review_at', now)
      .order('next_review_at')
    setCards(data ?? [])
    setLoading(false)
  }

  async function handleRating(rating: 0 | 1 | 2) {
    const card = cards[index]
    const result = sm2(card, rating)

    const supabase = createClient()
    await supabase
      .from('cards')
      .update({
        ease_factor: result.ease_factor,
        interval_days: result.interval_days,
        repetitions: result.repetitions,
        next_review_at: result.next_review_at.toISOString(),
        last_reviewed_at: new Date().toISOString(),
      })
      .eq('id', card.id)

    const newReviewed = reviewed + 1
    setReviewed(newReviewed)

    if (index + 1 >= cards.length) {
      await updateDailyStats(newReviewed)
      setDone(true)
    } else {
      setIndex(index + 1)
      setFlipped(false)
    }
  }

  async function updateDailyStats(totalReviewed: number) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const today = new Date().toISOString().split('T')[0]
    await supabase.from('daily_stats').upsert(
      { user_id: user.id, date: today, cards_reviewed: totalReviewed },
      { onConflict: 'user_id,date' }
    )
  }

  if (loading) return null

  if (cards.length === 0) {
    return (
      <main className="min-h-screen px-6 py-10 max-w-md mx-auto flex flex-col items-center justify-center text-center">
        <p className="text-5xl mb-6">✅</p>
        <h2 className="text-2xl font-bold mb-2">All caught up!</h2>
        <p className="opacity-50 mb-8">No cards due for review right now. Come back tomorrow!</p>
        <button
          onClick={() => router.push('/dashboard')}
          className="px-6 py-3 rounded-2xl font-semibold"
          style={{ backgroundColor: '#16a34a', color: '#fff' }}
        >
          Back to Dashboard
        </button>
      </main>
    )
  }

  if (done) {
    return (
      <main className="min-h-screen px-6 py-10 max-w-md mx-auto flex flex-col items-center justify-center text-center">
        <p className="text-5xl mb-6">🎉</p>
        <h2 className="text-2xl font-bold mb-2">Session complete!</h2>
        <p className="opacity-50 mb-2">You reviewed <span className="text-white font-semibold">{reviewed}</span> cards.</p>
        <p className="opacity-50 mb-8">Great work — see you tomorrow!</p>
        <button
          onClick={() => router.push('/dashboard')}
          className="px-6 py-3 rounded-2xl font-semibold"
          style={{ backgroundColor: '#16a34a', color: '#fff' }}
        >
          Back to Dashboard
        </button>
      </main>
    )
  }

  const card = cards[index]

  return (
    <main className="min-h-screen px-6 py-10 max-w-md mx-auto flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <button onClick={() => router.push('/dashboard')} className="opacity-50 hover:opacity-80 text-sm">
          ← Exit
        </button>
        <p className="text-sm opacity-40">{index + 1} / {cards.length}</p>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 rounded-full mb-10" style={{ backgroundColor: '#1a2e1f' }}>
        <div
          className="h-1.5 rounded-full transition-all"
          style={{ backgroundColor: '#16a34a', width: `${(index / cards.length) * 100}%` }}
        />
      </div>

      {/* Card */}
      <div
        className="flex-1 rounded-3xl p-8 flex flex-col justify-between cursor-pointer"
        style={{ backgroundColor: '#1a2e1f', minHeight: '320px' }}
        onClick={() => !flipped && setFlipped(true)}
      >
        <div>
          <p className="text-xs opacity-40 uppercase tracking-widest mb-4">
            {flipped ? 'Answer' : 'Question'}
          </p>
          <p className="text-xl leading-relaxed">
            {flipped ? card.answer : card.question}
          </p>
        </div>

        {!flipped && (
          <p className="text-sm opacity-30 text-center mt-8">Tap to reveal answer</p>
        )}
      </div>

      {/* Rating buttons — only show after flip */}
      {flipped && (
        <div className="grid grid-cols-3 gap-3 mt-6">
          <button
            onClick={() => handleRating(0)}
            className="py-4 rounded-2xl text-2xl transition-opacity hover:opacity-80"
            style={{ backgroundColor: '#3d1a1a' }}
          >
            👎
          </button>
          <button
            onClick={() => handleRating(1)}
            className="py-4 rounded-2xl text-2xl transition-opacity hover:opacity-80"
            style={{ backgroundColor: '#2a2a1a' }}
          >
            😐
          </button>
          <button
            onClick={() => handleRating(2)}
            className="py-4 rounded-2xl text-2xl transition-opacity hover:opacity-80"
            style={{ backgroundColor: '#1a3d1a' }}
          >
            👍
          </button>
        </div>
      )}
    </main>
  )
}
