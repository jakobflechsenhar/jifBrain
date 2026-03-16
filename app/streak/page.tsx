'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

type DailyStat = { date: string; cards_reviewed: number }
type StreakData = { current_streak: number; longest_streak: number; freeze_credits: number }

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAY_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

function dateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Infer which days a freeze credit was used:
// If two studied dates are 2 days apart, the day between was a freeze.
// If 3 days apart, the 2 days between were freezes.
function inferFreezeDates(studiedDates: string[]): Set<string> {
  const sorted = [...studiedDates].sort()
  const freezeDates = new Set<string>()
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = new Date(sorted[i])
    const b = new Date(sorted[i + 1])
    const diff = Math.round((b.getTime() - a.getTime()) / 86400000)
    if (diff === 2 || diff === 3) {
      for (let d = 1; d < diff; d++) {
        const fd = new Date(a)
        fd.setDate(a.getDate() + d)
        freezeDates.add(dateStr(fd))
      }
    }
  }
  return freezeDates
}

// Build calendar grid for a given year/month (0-indexed month)
// Returns array of rows, each row is 7 cells (null = empty padding)
function buildMonth(year: number, month: number): (number | null)[][] {
  const daysInMonth = new Date(year, month + 1, 0).getDate() // handles leap years automatically
  const firstDow = new Date(year, month, 1).getDay() // 0=Sun
  const startOffset = firstDow === 0 ? 6 : firstDow - 1 // convert to Mon-first

  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  // Pad to complete final week
  while (cells.length % 7 !== 0) cells.push(null)

  const rows: (number | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))
  return rows
}

export default function StreakPage() {
  const router = useRouter()
  const [stats, setStats] = useState<DailyStat[]>([])
  const [streak, setStreak] = useState<StreakData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/'); return }
      fetchData(user.id)
    })
  }, [router])

  async function fetchData(userId: string) {
    const supabase = createClient()
    const [{ data: statsData }, { data: streakData }] = await Promise.all([
      supabase.from('daily_stats').select('date, cards_reviewed').eq('user_id', userId),
      supabase.from('streaks').select('current_streak, longest_streak, freeze_credits').eq('user_id', userId).single(),
    ])
    setStats(statsData ?? [])
    setStreak(streakData)
    setLoading(false)
  }

  useEffect(() => {
    if (!loading) window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' })
  }, [loading])

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = dateStr(today)

  const studiedDates = new Set(stats.map(s => s.date))
  const freezeDates = inferFreezeDates([...studiedDates])

  // Show all months from January 2026 to current month, oldest first
  const months: { year: number; month: number }[] = []
  const startYear = 2026, startMonth = 0 // January 2026
  for (let y = startYear; y <= today.getFullYear(); y++) {
    const mStart = y === startYear ? startMonth : 0
    const mEnd = y === today.getFullYear() ? today.getMonth() : 11
    for (let m = mStart; m <= mEnd; m++) {
      months.push({ year: y, month: m })
    }
  }

  function getCellStyle(year: number, month: number, day: number) {
    const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const isToday = ds === todayStr
    const isFuture = ds > todayStr
    const studied = studiedDates.has(ds)
    const frozen = freezeDates.has(ds)

    let bg = '#1f1f1f'
    if (isFuture) bg = '#0d1a10'
    else if (studied) bg = '#16a34a'
    else if (frozen) bg = '#1e6fa8'
    else if (ds < todayStr) bg = '#3d1a1a'

    return {
      backgroundColor: bg,
      outline: isToday ? '2px solid #4ade80' : 'none',
      outlineOffset: '0px',
    }
  }

  if (loading) return null

  return (
    <main className="min-h-screen px-5 pb-10 max-w-md mx-auto">
      {/* Sticky header */}
      <div className="sticky top-0 pt-10 pb-4 z-10" style={{ backgroundColor: '#111714' }}>
        <div className="flex items-center mb-4">
          <button onClick={() => router.push('/dashboard')} className="opacity-50 hover:opacity-80 text-sm">← Back</button>
        </div>
        <h1 className="text-2xl font-bold mb-4" style={{ color: '#4ade80' }}>Streak History</h1>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl p-4 text-center" style={{ backgroundColor: '#1a2e1f' }}>
          <p className="text-2xl font-bold">{streak?.current_streak ?? 0}</p>
          <p className="text-xs opacity-40 mt-1">current</p>
        </div>
        <div className="rounded-2xl p-4 text-center" style={{ backgroundColor: '#1a2e1f' }}>
          <p className="text-2xl font-bold">{streak?.longest_streak ?? 0}</p>
          <p className="text-xs opacity-40 mt-1">longest</p>
        </div>
        <div className="rounded-2xl p-4 text-center" style={{ backgroundColor: '#1a2e1f' }}>
          <p className="text-2xl font-bold">{streak?.freeze_credits ?? 0}</p>
          <p className="text-xs opacity-40 mt-1">freezes left</p>
        </div>
        </div>
      </div>

      {/* Monthly calendars */}
      <div className="flex flex-col gap-8">
        {months.map(({ year, month }) => {
          const rows = buildMonth(year, month)
          return (
            <div key={`${year}-${month}`}>
              <p className="font-semibold mb-3">
                {MONTH_NAMES[month]} <span className="opacity-40">{year}</span>
              </p>

              {/* Day labels */}
              <div className="grid grid-cols-7 mb-1">
                {DAY_LABELS.map(l => (
                  <p key={l} className="text-center text-xs opacity-30 pb-1">{l}</p>
                ))}
              </div>

              {/* Weeks */}
              <div className="flex flex-col gap-1">
                {rows.map((row, ri) => (
                  <div key={ri} className="grid grid-cols-7 gap-1">
                    {row.map((day, di) => (
                      <div
                        key={di}
                        className="rounded-lg flex items-center justify-center"
                        style={{
                          aspectRatio: '1',
                          ...(day !== null ? getCellStyle(year, month, day) : { backgroundColor: 'transparent' }),
                        }}
                      >
                        {day !== null && (
                          <span className="text-xs font-medium" style={{ opacity: 0.85, fontSize: '10px' }}>
                            {day}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-8 justify-center">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#16a34a' }} />
          <span className="text-xs opacity-40">Studied</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#1e6fa8' }} />
          <span className="text-xs opacity-40">Freeze used</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#3d1a1a' }} />
          <span className="text-xs opacity-40">Missed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm outline outline-2" style={{ backgroundColor: '#1a2e1f', outlineColor: '#4ade80' }} />
          <span className="text-xs opacity-40">Today</span>
        </div>
      </div>
    </main>
  )
}
