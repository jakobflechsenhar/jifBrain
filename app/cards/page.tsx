'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase'

type Card = {
  id: string
  question: string
  answer: string
  question_image_url: string | null
  answer_image_url: string | null
  created_at: string
}

type Topic = {
  id: string
  name: string
}

async function uploadImage(file: File, userId: string, cardId: string, side: 'question' | 'answer'): Promise<string | null> {
  const supabase = createClient()
  const ext = file.name.split('.').pop()
  const path = `${userId}/${cardId}-${side}.${ext}`
  const { error } = await supabase.storage.from('card-images').upload(path, file, { upsert: true })
  if (error) return null
  const { data } = supabase.storage.from('card-images').getPublicUrl(path)
  return data.publicUrl
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
  const [qImageFile, setQImageFile] = useState<File | null>(null)
  const [qImagePreview, setQImagePreview] = useState<string | null>(null)
  const [aImageFile, setAImageFile] = useState<File | null>(null)
  const [aImagePreview, setAImagePreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Search
  const [search, setSearch] = useState('')

  // Delete confirmation
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // Edit state
  const [editingCard, setEditingCard] = useState<Card | null>(null)
  const [editQuestion, setEditQuestion] = useState('')
  const [editAnswer, setEditAnswer] = useState('')
  const [editTopics, setEditTopics] = useState<string[]>([])
  const [editQImageFile, setEditQImageFile] = useState<File | null>(null)
  const [editQImagePreview, setEditQImagePreview] = useState<string | null>(null)
  const [editRemoveQImage, setEditRemoveQImage] = useState(false)
  const [editAImageFile, setEditAImageFile] = useState<File | null>(null)
  const [editAImagePreview, setEditAImagePreview] = useState<string | null>(null)
  const [editRemoveAImage, setEditRemoveAImage] = useState(false)
  const [editSaving, setEditSaving] = useState(false)

  // Card topics map
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

    const [questionImageUrl, answerImageUrl] = await Promise.all([
      qImageFile ? uploadImage(qImageFile, user.id, card.id, 'question') : Promise.resolve(null),
      aImageFile ? uploadImage(aImageFile, user.id, card.id, 'answer') : Promise.resolve(null),
    ])

    if (questionImageUrl || answerImageUrl) {
      await supabase.from('cards').update({
        question_image_url: questionImageUrl,
        answer_image_url: answerImageUrl,
      }).eq('id', card.id)
    }

    if (selectedTopics.length > 0) {
      await supabase.from('card_topics').insert(
        selectedTopics.map(topicId => ({ card_id: card.id, topic_id: topicId }))
      )
    }

    setCards(prev => [{ ...card, question_image_url: questionImageUrl, answer_image_url: answerImageUrl }, ...prev])
    setCardTopicsMap(prev => ({ ...prev, [card.id]: selectedTopics }))
    setQuestion('')
    setAnswer('')
    setSelectedTopics([])
    setQImageFile(null)
    setQImagePreview(null)
    setAImageFile(null)
    setAImagePreview(null)
    setShowForm(false)
    setSaving(false)
  }

  function openEdit(card: Card) {
    setEditingCard(card)
    setEditQuestion(card.question)
    setEditAnswer(card.answer)
    setEditTopics(cardTopicsMap[card.id] ?? [])
    setEditQImageFile(null)
    setEditQImagePreview(card.question_image_url)
    setEditRemoveQImage(false)
    setEditAImageFile(null)
    setEditAImagePreview(card.answer_image_url)
    setEditRemoveAImage(false)
  }

  async function handleEditCard(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editingCard) return
    setEditSaving(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    let questionImageUrl = editRemoveQImage ? null : editingCard.question_image_url
    let answerImageUrl = editRemoveAImage ? null : editingCard.answer_image_url

    const [newQ, newA] = await Promise.all([
      editQImageFile ? uploadImage(editQImageFile, user.id, editingCard.id, 'question') : Promise.resolve(null),
      editAImageFile ? uploadImage(editAImageFile, user.id, editingCard.id, 'answer') : Promise.resolve(null),
    ])
    if (newQ) questionImageUrl = newQ
    if (newA) answerImageUrl = newA

    await supabase.from('cards').update({
      question: editQuestion,
      answer: editAnswer,
      question_image_url: questionImageUrl,
      answer_image_url: answerImageUrl,
    }).eq('id', editingCard.id)

    await supabase.from('card_topics').delete().eq('card_id', editingCard.id)
    if (editTopics.length > 0) {
      await supabase.from('card_topics').insert(
        editTopics.map(topicId => ({ card_id: editingCard.id, topic_id: topicId }))
      )
    }

    setCards(prev => prev.map(c => c.id === editingCard.id
      ? { ...c, question: editQuestion, answer: editAnswer, question_image_url: questionImageUrl, answer_image_url: answerImageUrl }
      : c
    ))
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

  // Edit screen
  if (editingCard) {
    return (
      <main className="min-h-screen px-6 py-10 max-w-md mx-auto">
        <div className="flex items-center justify-between mb-8">
          <button onClick={() => setEditingCard(null)} className="opacity-50 hover:opacity-80 text-sm">← Cancel</button>
          <h1 className="text-xl font-bold" style={{ color: '#4ade80' }}>Edit Card</h1>
          <div className="w-16" />
        </div>

        <form onSubmit={handleEditCard} className="flex flex-col gap-4">
          <div>
            <p className="text-xs opacity-40 uppercase tracking-widest mb-2">Question</p>
            <textarea value={editQuestion} onChange={e => setEditQuestion(e.target.value)} required rows={2}
              placeholder="Question"
              className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-green-500 resize-none mb-2" />
            {editQImagePreview && !editRemoveQImage ? (
              <div className="relative rounded-xl overflow-hidden mb-2" style={{ aspectRatio: '16/9' }}>
                <Image src={editQImagePreview} alt="question image" fill style={{ objectFit: 'cover' }} unoptimized={editQImagePreview.startsWith('blob:')} />
                <button type="button" onClick={() => { setEditRemoveQImage(true); setEditQImagePreview(null) }}
                  className="absolute top-2 right-2 px-2 py-1 rounded-lg text-xs"
                  style={{ backgroundColor: '#3d1a1a', color: '#f87171' }}>
                  Remove
                </button>
              </div>
            ) : (
              <label className="flex items-center gap-2 px-4 py-3 rounded-xl cursor-pointer text-sm opacity-50 hover:opacity-80"
                style={{ backgroundColor: '#ffffff10' }}>
                📷 {editRemoveQImage ? 'Add image' : (editingCard.question_image_url ? 'Replace image' : 'Add image')}
                <input type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) { setEditQImageFile(f); setEditQImagePreview(URL.createObjectURL(f)); setEditRemoveQImage(false) } }} />
              </label>
            )}
          </div>

          <div>
            <p className="text-xs opacity-40 uppercase tracking-widest mb-2">Answer</p>
            <textarea value={editAnswer} onChange={e => setEditAnswer(e.target.value)} required rows={3}
              placeholder="Answer"
              className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-green-500 resize-none mb-2" />
            {editAImagePreview && !editRemoveAImage ? (
              <div className="relative rounded-xl overflow-hidden mb-2" style={{ aspectRatio: '16/9' }}>
                <Image src={editAImagePreview} alt="answer image" fill style={{ objectFit: 'cover' }} unoptimized={editAImagePreview.startsWith('blob:')} />
                <button type="button" onClick={() => { setEditRemoveAImage(true); setEditAImagePreview(null) }}
                  className="absolute top-2 right-2 px-2 py-1 rounded-lg text-xs"
                  style={{ backgroundColor: '#3d1a1a', color: '#f87171' }}>
                  Remove
                </button>
              </div>
            ) : (
              <label className="flex items-center gap-2 px-4 py-3 rounded-xl cursor-pointer text-sm opacity-50 hover:opacity-80"
                style={{ backgroundColor: '#ffffff10' }}>
                📷 {editRemoveAImage ? 'Add image' : (editingCard.answer_image_url ? 'Replace image' : 'Add image')}
                <input type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) { setEditAImageFile(f); setEditAImagePreview(URL.createObjectURL(f)); setEditRemoveAImage(false) } }} />
              </label>
            )}
          </div>

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

          <div className="mb-3">
            <p className="text-xs opacity-40 uppercase tracking-widest mb-2">Question</p>
            <textarea placeholder="Question" value={question} onChange={e => setQuestion(e.target.value)}
              required rows={2}
              className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-green-500 resize-none mb-2" />
            {qImagePreview ? (
              <div className="relative rounded-xl overflow-hidden mb-2" style={{ aspectRatio: '16/9' }}>
                <Image src={qImagePreview} alt="preview" fill style={{ objectFit: 'cover' }} unoptimized />
                <button type="button" onClick={() => { setQImageFile(null); setQImagePreview(null) }}
                  className="absolute top-2 right-2 px-2 py-1 rounded-lg text-xs"
                  style={{ backgroundColor: '#3d1a1a', color: '#f87171' }}>
                  Remove
                </button>
              </div>
            ) : (
              <label className="flex items-center gap-2 px-4 py-3 rounded-xl cursor-pointer text-sm opacity-50 hover:opacity-80"
                style={{ backgroundColor: '#ffffff10' }}>
                📷 Add image (optional)
                <input type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) { setQImageFile(f); setQImagePreview(URL.createObjectURL(f)) } }} />
              </label>
            )}
          </div>

          <div className="mb-4">
            <p className="text-xs opacity-40 uppercase tracking-widest mb-2">Answer</p>
            <textarea placeholder="Answer" value={answer} onChange={e => setAnswer(e.target.value)}
              required rows={3}
              className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-green-500 resize-none mb-2" />
            {aImagePreview ? (
              <div className="relative rounded-xl overflow-hidden mb-2" style={{ aspectRatio: '16/9' }}>
                <Image src={aImagePreview} alt="preview" fill style={{ objectFit: 'cover' }} unoptimized />
                <button type="button" onClick={() => { setAImageFile(null); setAImagePreview(null) }}
                  className="absolute top-2 right-2 px-2 py-1 rounded-lg text-xs"
                  style={{ backgroundColor: '#3d1a1a', color: '#f87171' }}>
                  Remove
                </button>
              </div>
            ) : (
              <label className="flex items-center gap-2 px-4 py-3 rounded-xl cursor-pointer text-sm opacity-50 hover:opacity-80"
                style={{ backgroundColor: '#ffffff10' }}>
                📷 Add image (optional)
                <input type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) { setAImageFile(f); setAImagePreview(URL.createObjectURL(f)) } }} />
              </label>
            )}
          </div>

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

      {cards.length > 0 && (
        <input type="text" placeholder="Search cards..." value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-green-500 mb-4" />
      )}

      {cards.length === 0 ? (
        <div className="text-center opacity-40 mt-20">
          <p className="text-lg mb-2">No cards yet</p>
          <p className="text-sm">Tap "+ Add" to create your first card</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {cards.filter(card => {
            if (!search) return true
            const q = search.toLowerCase()
            return card.question.toLowerCase().includes(q) || card.answer.toLowerCase().includes(q)
          }).map(card => {
            const topicNames = (cardTopicsMap[card.id] ?? [])
              .map(tid => topics.find(t => t.id === tid)?.name).filter(Boolean)
            return (
              <div key={card.id} className="rounded-2xl p-5" style={{ backgroundColor: '#1a2e1f' }}>
                {card.question_image_url && (
                  <div className="relative rounded-xl overflow-hidden mb-3" style={{ aspectRatio: '16/9' }}>
                    <Image src={card.question_image_url} alt="question" fill style={{ objectFit: 'cover' }} />
                  </div>
                )}
                <p className="font-medium mb-1">{card.question}</p>
                {card.answer_image_url && (
                  <div className="relative rounded-xl overflow-hidden mt-2 mb-2" style={{ aspectRatio: '16/9' }}>
                    <Image src={card.answer_image_url} alt="answer" fill style={{ objectFit: 'cover' }} />
                  </div>
                )}
                <p className="text-sm opacity-50 mb-3">{card.answer}</p>
                {topicNames.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {topicNames.map(name => (
                      <span key={name} className="px-2 py-0.5 rounded-full text-xs" style={{ backgroundColor: '#ffffff15' }}>{name}</span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <button onClick={() => openEdit(card)} className="px-4 py-1.5 rounded-xl text-sm" style={{ backgroundColor: '#ffffff10' }}>Edit</button>
                  {confirmDeleteId === card.id ? (
                    <>
                      <button onClick={() => handleDeleteCard(card.id)} className="px-4 py-1.5 rounded-xl text-sm" style={{ backgroundColor: '#3d1a1a', color: '#f87171' }}>Confirm</button>
                      <button onClick={() => setConfirmDeleteId(null)} className="px-4 py-1.5 rounded-xl text-sm" style={{ backgroundColor: '#ffffff10' }}>Cancel</button>
                    </>
                  ) : (
                    <button onClick={() => setConfirmDeleteId(card.id)} className="px-4 py-1.5 rounded-xl text-sm" style={{ backgroundColor: '#3d1a1a', color: '#f87171' }}>Delete</button>
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
