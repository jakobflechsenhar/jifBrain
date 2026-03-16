'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase'
import { sm2 } from '@/lib/sm2'

type Card = {
  id: string
  question: string
  answer: string
  question_image_url: string | null
  answer_image_url: string | null
  ease_factor: number
  interval_days: number
  repetitions: number
}

type Topic = {
  id: string
  name: string
}

const DAILY_GOAL = 10

export default function StudyPage() {
  const router = useRouter()

  // Topic picker
  const [topics, setTopics] = useState<Topic[]>([])
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null) // null = not chosen yet, 'all' = all topics
  const [topicsLoading, setTopicsLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  const [shuffle, setShuffle] = useState(false)

  // Session
  const [cards, setCards] = useState<Card[]>([])
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [cardsLoading, setCardsLoading] = useState(false)
  const [reviewed, setReviewed] = useState(0)
  const [goalReached, setGoalReached] = useState(false)
  const [sessionStart] = useState(() => Date.now())

  // Load topics on mount
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/'); return }
      setUserId(user.id)
      supabase.from('topics').select('id, name').eq('user_id', user.id).order('name')
        .then(({ data }) => {
          setTopics(data ?? [])
          setTopicsLoading(false)
        })
    })
  }, [router])

  async function startSession(topicId: string) {
    if (!userId) return
    setSelectedTopic(topicId)
    setCardsLoading(true)

    const supabase = createClient()

    let query = supabase
      .from('cards')
      .select('id, question, answer, question_image_url, answer_image_url, ease_factor, interval_days, repetitions')
      .eq('user_id', userId)
      .order('next_review_at')

    if (topicId !== 'all') {
      // Get card IDs for this topic
      const { data: cardTopics } = await supabase
        .from('card_topics')
        .select('card_id')
        .eq('topic_id', topicId)

      const cardIds = (cardTopics ?? []).map(ct => ct.card_id)
      if (cardIds.length === 0) {
        setCards([])
        setCardsLoading(false)
        return
      }
      query = query.in('id', cardIds)
    }

    const { data } = await query
    const result = data ?? []
    setCards(shuffle ? result.sort(() => Math.random() - 0.5) : result)
    setCardsLoading(false)
    setIndex(0)
    setReviewed(0)
    setGoalReached(false)
    setFlipped(false)
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

    if (newReviewed % DAILY_GOAL === 0) {
      await updateDailyStats(newReviewed)
      await updateStreak()
      setGoalReached(true)
      setIndex(index + 1 >= cards.length ? 0 : index + 1)
      setFlipped(false)
    } else if (index + 1 >= cards.length) {
      setIndex(0)
      setFlipped(false)
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
    const secondsSpent = Math.floor((Date.now() - sessionStart) / 1000)
    await supabase.from('daily_stats').upsert(
      { user_id: user.id, date: today, cards_reviewed: totalReviewed, time_spent_seconds: secondsSpent },
      { onConflict: 'user_id,date' }
    )
  }

  async function updateStreak() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    const monday = new Date(today)
    monday.setDate(today.getDate() - today.getDay() + 1)
    const mondayStr = monday.toISOString().split('T')[0]

    const { data: streak } = await supabase
      .from('streaks').select('*').eq('user_id', user.id).single()

    if (!streak) {
      await supabase.from('streaks').insert({
        user_id: user.id, current_streak: 1, longest_streak: 1,
        last_study_date: todayStr, freeze_credits: 2, freeze_credits_reset_at: mondayStr,
      })
      return
    }

    let freezeCredits = streak.freeze_credits
    if (!streak.freeze_credits_reset_at || streak.freeze_credits_reset_at < mondayStr) {
      freezeCredits = 2
    }

    const last = streak.last_study_date
    if (last === todayStr) return

    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]

    let newStreak = streak.current_streak

    if (last === yesterdayStr) {
      newStreak += 1
    } else {
      const daysMissed = last
        ? Math.floor((today.getTime() - new Date(last).getTime()) / 86400000) - 1
        : 0
      if (daysMissed > 0 && freezeCredits >= daysMissed) {
        freezeCredits -= daysMissed
        newStreak += 1
      } else {
        newStreak = 1
      }
    }

    await supabase.from('streaks').update({
      current_streak: newStreak,
      longest_streak: Math.max(newStreak, streak.longest_streak),
      last_study_date: todayStr,
      freeze_credits: freezeCredits,
      freeze_credits_reset_at: mondayStr,
    }).eq('user_id', user.id)
  }

  // ── Topic picker screen ──
  if (topicsLoading) return null

  if (selectedTopic === null) {
    return (
      <main className="min-h-screen px-6 py-10 max-w-md mx-auto">
        <div className="flex items-center mb-8">
          <button onClick={() => router.push('/dashboard')} className="opacity-50 hover:opacity-80 text-sm">
            ← Back
          </button>
        </div>
        <h1 className="text-2xl font-bold mb-2" style={{ color: '#4ade80' }}>What to study?</h1>
        <p className="opacity-40 text-sm mb-8">Choose a topic or study everything at once</p>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => startSession('all')}
            className="w-full py-4 rounded-2xl font-semibold text-left px-6"
            style={{ backgroundColor: '#16a34a', color: '#fff' }}
          >
            <p className="font-bold">🎲 All Topics</p>
            <p className="text-sm opacity-70 mt-0.5">Random mix from your full deck</p>
          </button>

          {topics.map(t => (
            <button
              key={t.id}
              onClick={() => startSession(t.id)}
              className="w-full py-4 rounded-2xl text-left px-6 transition-opacity hover:opacity-80"
              style={{ backgroundColor: '#1a2e1f' }}
            >
              <p className="font-semibold">{t.name}</p>
            </button>
          ))}

          {topics.length === 0 && (
            <p className="text-sm opacity-40 text-center mt-4">No topics yet — you can still study all cards.</p>
          )}
        </div>
      </main>
    )
  }

  // ── Loading cards ──
  if (cardsLoading) return null

  // ── No cards in this topic ──
  if (cards.length === 0) {
    return (
      <main className="min-h-screen px-6 py-10 max-w-md mx-auto flex flex-col items-center justify-center text-center">
        <p className="text-5xl mb-6">📭</p>
        <h2 className="text-2xl font-bold mb-2">No cards here</h2>
        <p className="opacity-50 mb-8">Add cards to this topic first.</p>
        <button onClick={() => setSelectedTopic(null)} className="px-6 py-3 rounded-2xl font-semibold" style={{ backgroundColor: '#1a2e1f' }}>
          ← Back to topics
        </button>
      </main>
    )
  }

  // ── Goal reached screen ──
  if (goalReached) {
    return (
      <main className="min-h-screen px-6 py-10 max-w-md mx-auto flex flex-col items-center justify-center text-center">
        <p className="text-5xl mb-6">🔥</p>
        <h2 className="text-2xl font-bold mb-2">Daily goal reached!</h2>
        <p className="opacity-50 mb-8">You reviewed <span className="text-white font-semibold">{reviewed}</span> cards — streak extended!</p>
        <button
          onClick={() => setGoalReached(false)}
          className="w-full max-w-xs py-4 rounded-2xl font-semibold mb-3"
          style={{ backgroundColor: '#16a34a', color: '#fff' }}
        >
          Keep Going
        </button>
        <button
          onClick={() => router.push('/dashboard')}
          className="w-full max-w-xs py-4 rounded-2xl font-semibold"
          style={{ backgroundColor: '#1a2e1f', color: '#fff' }}
        >
          I&apos;m Done
        </button>
      </main>
    )
  }

  // ── Study session ──
  const card = cards[index]
  const topicLabel = selectedTopic === 'all'
    ? 'All Topics'
    : topics.find(t => t.id === selectedTopic)?.name ?? ''

  return (
    <main className="min-h-screen px-6 py-10 max-w-md mx-auto flex flex-col">
      <div className="flex items-center justify-between mb-8">
        <button onClick={() => setSelectedTopic(null)} className="opacity-50 hover:opacity-80 text-sm">
          ← Exit
        </button>
        <div className="text-center">
          <p className="text-xs opacity-30 mb-0.5">{topicLabel}</p>
          <p className="text-sm opacity-40">{index + 1} / {cards.length}</p>
        </div>
        <button
          onClick={() => {
            setShuffle(s => !s)
            setCards(prev => !shuffle ? [...prev].sort(() => Math.random() - 0.5) : prev)
          }}
          className="text-lg px-2 py-1 rounded-lg transition-opacity"
          style={{ backgroundColor: shuffle ? '#16a34a' : '#ffffff15' }}
          title="Shuffle"
        >
          🔀
        </button>
      </div>

      <div className="w-full h-1.5 rounded-full mb-10" style={{ backgroundColor: '#1a2e1f' }}>
        <div
          className="h-1.5 rounded-full transition-all"
          style={{ backgroundColor: '#16a34a', width: `${((index + 1) / cards.length) * 100}%` }}
        />
      </div>

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
          {(flipped ? card.answer_image_url : card.question_image_url) && (
            <div className="mt-5 relative w-full rounded-xl overflow-hidden" style={{ aspectRatio: '16/9' }}>
              <Image src={(flipped ? card.answer_image_url : card.question_image_url)!} alt="" fill style={{ objectFit: 'contain' }} unoptimized />
            </div>
          )}
        </div>
        {!flipped && (
          <p className="text-sm opacity-30 text-center mt-8">Tap to reveal answer</p>
        )}
      </div>

      {flipped && (
        <div className="grid grid-cols-3 gap-3 mt-6">
          <button onClick={() => handleRating(0)} className="py-4 rounded-2xl text-2xl transition-opacity hover:opacity-80" style={{ backgroundColor: '#3d1a1a' }}>👎</button>
          <button onClick={() => handleRating(1)} className="py-4 rounded-2xl text-2xl transition-opacity hover:opacity-80" style={{ backgroundColor: '#2a2a1a' }}>😐</button>
          <button onClick={() => handleRating(2)} className="py-4 rounded-2xl text-2xl transition-opacity hover:opacity-80" style={{ backgroundColor: '#1a3d1a' }}>👍</button>
        </div>
      )}
    </main>
  )
}
