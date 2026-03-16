'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase'

type GeneratedCard = {
  question: string
  answer: string
  selected: boolean
}

type Topic = {
  id: string
  name: string
}

async function fileToBase64(file: File): Promise<{ data: string; mediaType: string }> {
  const buf = await file.arrayBuffer()
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return { data: btoa(binary), mediaType: file.type }
}

export default function GeneratePage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [topics, setTopics] = useState<Topic[]>([])

  const [text, setText] = useState('')
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])

  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [cards, setCards] = useState<GeneratedCard[] | null>(null)
  const [selectedTopics, setSelectedTopics] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/'); return }
      setUserId(user.id)
      supabase.from('topics').select('id, name').eq('user_id', user.id).order('name')
        .then(({ data }) => setTopics(data ?? []))
    })
  }, [router])

  function addImages(files: FileList | null) {
    if (!files) return
    const newFiles = Array.from(files)
    setImageFiles(prev => [...prev, ...newFiles])
    setImagePreviews(prev => [...prev, ...newFiles.map(f => URL.createObjectURL(f))])
  }

  function removeImage(i: number) {
    setImageFiles(prev => prev.filter((_, idx) => idx !== i))
    setImagePreviews(prev => prev.filter((_, idx) => idx !== i))
  }

  async function handleGenerate() {
    if (!text.trim() && imageFiles.length === 0) {
      setError('Add some text or images to generate from.')
      return
    }
    setGenerating(true)
    setError('')
    setCards(null)

    const images = await Promise.all(imageFiles.map(fileToBase64))

    const res = await fetch('/api/generate-cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, images }),
    })

    const json = await res.json()
    if (!res.ok || json.error) {
      setError(json.error ?? 'Something went wrong. Try again.')
      setGenerating(false)
      return
    }

    const { cards: generated } = json
    setCards(generated.map((c: { question: string; answer: string }) => ({ ...c, selected: true })))
    setGenerating(false)
  }

  function updateCard(i: number, field: 'question' | 'answer', value: string) {
    setCards(prev => prev!.map((c, idx) => idx === i ? { ...c, [field]: value } : c))
  }

  function toggleCard(i: number) {
    setCards(prev => prev!.map((c, idx) => idx === i ? { ...c, selected: !c.selected } : c))
  }

  function toggleTopic(id: string) {
    setSelectedTopics(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id])
  }

  async function handleSave() {
    if (!userId) return
    const toSave = cards!.filter(c => c.selected)
    if (toSave.length === 0) return
    setSaving(true)

    const supabase = createClient()
    const inserted = await Promise.all(
      toSave.map(c =>
        supabase.from('cards')
          .insert({ id: crypto.randomUUID(), user_id: userId, question: c.question, answer: c.answer })
          .select('id')
          .single()
      )
    )

    if (selectedTopics.length > 0) {
      const junctionRows = inserted.flatMap(({ data }) =>
        data ? selectedTopics.map(tid => ({ card_id: data.id, topic_id: tid })) : []
      )
      if (junctionRows.length > 0) await supabase.from('card_topics').insert(junctionRows)
    }

    router.push('/cards')
  }

  const selectedCount = cards?.filter(c => c.selected).length ?? 0

  return (
    <main className="min-h-screen px-6 py-10 max-w-md mx-auto">
      <div className="flex items-center mb-8">
        <button onClick={() => router.push('/cards')} className="opacity-50 hover:opacity-80 text-sm">← Back</button>
      </div>
      <h1 className="text-2xl font-bold mb-1" style={{ color: '#4ade80' }}>AI Generate</h1>
      <p className="text-sm opacity-40 mb-6">Paste notes or add images — Claude will turn them into flashcards.</p>

      {/* Input section — hide once cards are generated */}
      {!cards && (
        <>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Paste your notes, definitions, or any text here..."
            rows={7}
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-green-500 resize-none mb-3"
          />

          {/* Image thumbnails */}
          {imagePreviews.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {imagePreviews.map((src, i) => (
                <div key={i} className="relative rounded-lg overflow-hidden" style={{ width: 72, height: 56 }}>
                  <Image src={src} alt="" fill style={{ objectFit: 'cover' }} unoptimized />
                  <button
                    onClick={() => removeImage(i)}
                    className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full text-xs flex items-center justify-center font-bold"
                    style={{ backgroundColor: '#3d1a1a', color: '#f87171', fontSize: 9 }}
                  >✕</button>
                </div>
              ))}
            </div>
          )}

          <label className="flex items-center gap-2 px-4 py-3 rounded-xl cursor-pointer text-sm opacity-50 hover:opacity-80 mb-4"
            style={{ backgroundColor: '#ffffff10' }}>
            📷 Add images (optional)
            <input type="file" accept="image/*" multiple className="hidden" onChange={e => addImages(e.target.files)} />
          </label>

          {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full py-4 rounded-2xl font-semibold disabled:opacity-50"
            style={{ backgroundColor: '#16a34a', color: '#fff' }}
          >
            {generating ? 'Generating…' : '✨ Generate Cards'}
          </button>
        </>
      )}

      {/* Review section */}
      {cards && (
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm opacity-50">{cards.length} cards generated</p>
            <button onClick={() => setCards(null)} className="text-sm opacity-40 hover:opacity-70">← Edit input</button>
          </div>

          <div className="flex flex-col gap-3 mb-6">
            {cards.map((card, i) => (
              <div
                key={i}
                className="rounded-2xl p-4 transition-opacity"
                style={{ backgroundColor: '#1a2e1f', opacity: card.selected ? 1 : 0.35 }}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <p className="text-xs opacity-40 uppercase tracking-widest pt-1">Card {i + 1}</p>
                  <button
                    onClick={() => toggleCard(i)}
                    className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 text-xs font-bold mt-0.5"
                    style={{ backgroundColor: card.selected ? '#16a34a' : '#ffffff15' }}
                  >
                    {card.selected ? '✓' : ''}
                  </button>
                </div>
                <textarea
                  value={card.question}
                  onChange={e => updateCard(i, 'question', e.target.value)}
                  rows={2}
                  placeholder="Question"
                  className="w-full px-3 py-2 rounded-lg bg-white/10 text-white text-sm placeholder-white/30 focus:outline-none resize-none mb-2"
                />
                <textarea
                  value={card.answer}
                  onChange={e => updateCard(i, 'answer', e.target.value)}
                  rows={3}
                  placeholder="Answer"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 text-white text-sm placeholder-white/30 focus:outline-none resize-none opacity-80"
                />
              </div>
            ))}
          </div>

          {/* Topic assignment */}
          {topics.length > 0 && (
            <div className="mb-6">
              <p className="text-sm opacity-50 mb-2">Assign topics (optional)</p>
              <div className="flex flex-wrap gap-2">
                {topics.map(t => (
                  <button key={t.id} onClick={() => toggleTopic(t.id)}
                    className="px-3 py-1 rounded-full text-sm"
                    style={{ backgroundColor: selectedTopics.includes(t.id) ? '#16a34a' : '#ffffff15', color: '#fff' }}>
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving || selectedCount === 0}
            className="w-full py-4 rounded-2xl font-semibold disabled:opacity-50"
            style={{ backgroundColor: '#16a34a', color: '#fff' }}
          >
            {saving ? 'Saving…' : `Save ${selectedCount} card${selectedCount !== 1 ? 's' : ''}`}
          </button>
        </>
      )}
    </main>
  )
}
