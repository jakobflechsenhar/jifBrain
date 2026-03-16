// SM-2 spaced repetition algorithm
// rating: 0 = hard (thumbs down), 1 = okay (neutral), 2 = easy (thumbs up)

export type CardSM2 = {
  ease_factor: number
  interval_days: number
  repetitions: number
}

export function sm2(card: CardSM2, rating: 0 | 1 | 2): CardSM2 & { next_review_at: Date } {
  let { ease_factor, interval_days, repetitions } = card

  if (rating === 0) {
    // Hard: reset repetitions, show again soon
    repetitions = 0
    interval_days = 1
  } else {
    // Okay or Easy: advance the schedule
    if (repetitions === 0) interval_days = 1
    else if (repetitions === 1) interval_days = 3
    else interval_days = Math.round(interval_days * ease_factor)

    repetitions += 1
  }

  // Adjust ease factor based on rating (0=hard, 1=okay, 2=easy)
  ease_factor = ease_factor + (0.1 - (2 - rating) * (0.08 + (2 - rating) * 0.02))
  ease_factor = Math.max(1.3, ease_factor) // never go below 1.3

  const next_review_at = new Date()
  next_review_at.setDate(next_review_at.getDate() + interval_days)

  return { ease_factor, interval_days, repetitions, next_review_at }
}
