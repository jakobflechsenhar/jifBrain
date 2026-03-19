'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Papa from 'papaparse'
import { createClient } from '@/lib/supabase'

type ImportedCard = {
  question: string
  answer: string
  selected: boolean
}

type Topic = {
  id: string
  name: string
}

export default function ImportPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [topics, setTopics] = useState<Topic[]>([])

  const [cards, setCards] = useState<ImportedCard[] | null>(null)
  const [error, setError] = useState('')
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

  function handleFile(file: File) {
    setError('')
    setCards(null)

    Papa.parse(file, {
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as string[][]
        if (rows.length === 0) { setError('The file appears to be empty.'); return }

        // Auto-skip header row if first row looks like labels (no "?" and short text)
        const firstRow = rows[0]
        if (firstRow.length < 2) { setError('Each row needs at least 2 columns: question and answer.'); return }

        const isHeader = firstRow[0].toLowerCase().includes('question') || firstRow[0].toLowerCase().includes('front')
        const dataRows = isHeader ? rows.slice(1) : rows

        if (dataRows.length === 0) { setError('No card data found after the header row.'); return }

        const parsed: ImportedCard[] = dataRows
          .filter(row => row[0]?.trim() && row[1]?.trim())
          .map(row => ({ question: row[0].trim(), answer: row[1].trim(), selected: true }))

        if (parsed.length === 0) { setError('No valid rows found. Make sure each row has a question and answer.'); return }

        setCards(parsed)
      },
      error: () => setError('Failed to parse the file. Make sure it\'s a valid CSV.'),
    })
  }

  function toggleCard(i: number) {
    setCards(prev => prev!.map((c, idx) => idx === i ? { ...c, selected: !c.selected } : c))
  }

  function updateCard(i: number, field: 'question' | 'answer', value: string) {
    setCards(prev => prev!.map((c, idx) => idx === i ? { ...c, [field]: value } : c))
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
          .select('id').single()
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
      <h1 className="text-2xl font-bold mb-1" style={{ color: '#4ade80' }}>Import CSV</h1>
      <p className="text-sm opacity-40 mb-6">
        Upload a CSV file with two columns: <span className="opacity-80">question</span> and <span className="opacity-80">answer</span>. One card per row.
      </p>

      {!cards && (
        <>
          <label
            className="flex flex-col items-center justify-center w-full py-12 rounded-2xl cursor-pointer transition-opacity hover:opacity-80"
            style={{ backgroundColor: '#1a2e1f', border: '2px dashed #ffffff20' }}
          >
            <p className="text-3xl mb-3">📄</p>
            <p className="font-semibold mb-1">Choose a CSV file</p>
            <p className="text-sm opacity-40">Tap to browse</p>
            <input type="file" accept=".csv,text/csv" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
          </label>

          {error && <p className="text-red-400 text-sm mt-4">{error}</p>}

        </>
      )}

      {cards && (
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm opacity-50">{cards.length} cards found</p>
            <button onClick={() => setCards(null)} className="text-sm opacity-40 hover:opacity-70">← Re-upload</button>
          </div>

          <div className="flex flex-col gap-3 mb-6">
            {cards.map((card, i) => (
              <div key={i} className="rounded-2xl p-4 transition-opacity"
                style={{ backgroundColor: '#1a2e1f', opacity: card.selected ? 1 : 0.35 }}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <p className="text-xs opacity-40 uppercase tracking-widest pt-1">Card {i + 1}</p>
                  <button onClick={() => toggleCard(i)}
                    className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 text-xs font-bold mt-0.5"
                    style={{ backgroundColor: card.selected ? '#16a34a' : '#ffffff15' }}>
                    {card.selected ? '✓' : ''}
                  </button>
                </div>
                <textarea value={card.question} onChange={e => updateCard(i, 'question', e.target.value)} rows={2}
                  placeholder="Question"
                  className="w-full px-3 py-2 rounded-lg bg-white/10 text-white text-sm placeholder-white/30 focus:outline-none resize-none mb-2" />
                <textarea value={card.answer} onChange={e => updateCard(i, 'answer', e.target.value)} rows={2}
                  placeholder="Answer"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 text-white text-sm placeholder-white/30 focus:outline-none resize-none opacity-80" />
              </div>
            ))}
          </div>

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

          <button onClick={handleSave} disabled={saving || selectedCount === 0}
            className="w-full py-4 rounded-2xl font-semibold disabled:opacity-50"
            style={{ backgroundColor: '#16a34a', color: '#fff' }}>
            {saving ? 'Saving…' : `Save ${selectedCount} card${selectedCount !== 1 ? 's' : ''}`}
          </button>
        </>
      )}
    </main>
  )
}
