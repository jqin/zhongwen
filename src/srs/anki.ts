/**
 * Simplified Anki-style SM-2 scheduler with learning steps.
 * Ratings: 1 Again · 2 Hard · 3 Good · 4 Easy.
 */

export type CardState = {
  key: string;
  due: number; // epoch ms
  ivl: number; // days (fractional while learning)
  ease: number;
  reps: number;
  lapses: number;
  state: 'learning' | 'review' | 'relearning';
};

export const MIN_EASE = 1.3;
export const START_EASE = 2.5;

const MIN = 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

/** Learning steps in minutes before a card graduates to review. */
const LEARNING_STEPS = [1, 10];
const GRADUATE_IVL = 1; // days
const EASY_IVL = 4; // days

export function newCard(key: string, now = Date.now()): CardState {
  return { key, due: now, ivl: 0, ease: START_EASE, reps: 0, lapses: 0, state: 'learning' };
}

function fuzz(days: number): number {
  if (days < 2) return days;
  const spread = Math.max(1, days * 0.05);
  return days + (Math.random() * 2 - 1) * spread;
}

export function applyRating(card: CardState, rating: 1 | 2 | 3 | 4, now = Date.now()): CardState {
  const next = { ...card, reps: card.reps + 1 };

  if (card.state === 'learning' || card.state === 'relearning') {
    // ivl doubles as the learning-step index while learning
    const step = Math.min(Math.floor(card.ivl), LEARNING_STEPS.length - 1);
    if (rating === 1) {
      next.ivl = 0;
      next.due = now + LEARNING_STEPS[0] * MIN;
    } else if (rating === 4) {
      next.state = 'review';
      next.ivl = EASY_IVL;
      next.due = now + fuzz(EASY_IVL) * DAY;
    } else if (step + 1 < LEARNING_STEPS.length && rating === 2) {
      next.ivl = step; // stay on the current step
      next.due = now + LEARNING_STEPS[step] * MIN;
    } else if (step + 1 < LEARNING_STEPS.length) {
      next.ivl = step + 1;
      next.due = now + LEARNING_STEPS[step + 1] * MIN;
    } else {
      next.state = 'review';
      next.ivl = GRADUATE_IVL;
      next.due = now + fuzz(GRADUATE_IVL) * DAY;
    }
    return next;
  }

  // review state
  if (rating === 1) {
    next.state = 'relearning';
    next.lapses = card.lapses + 1;
    next.ease = Math.max(MIN_EASE, card.ease - 0.2);
    next.ivl = 0;
    next.due = now + LEARNING_STEPS[1] * MIN;
    return next;
  }

  let ivl: number;
  if (rating === 2) {
    ivl = Math.max(card.ivl + 1, card.ivl * 1.2);
    next.ease = Math.max(MIN_EASE, card.ease - 0.15);
  } else if (rating === 3) {
    ivl = Math.max(card.ivl + 1, card.ivl * card.ease);
  } else {
    ivl = Math.max(card.ivl + 1, card.ivl * card.ease * 1.3);
    next.ease = card.ease + 0.15;
  }
  next.ivl = Math.min(ivl, 365 * 10);
  next.due = now + fuzz(next.ivl) * DAY;
  return next;
}

/** Human label for the interval a rating would produce, e.g. "10m", "3d". */
export function previewInterval(card: CardState, rating: 1 | 2 | 3 | 4): string {
  const next = applyRating({ ...card }, rating, Date.now());
  const ms = next.due - Date.now();
  if (ms < 60 * MIN) return `${Math.max(1, Math.round(ms / MIN))}m`;
  if (ms < DAY) return `${Math.round(ms / (60 * MIN))}h`;
  const days = Math.round(ms / DAY);
  if (days < 30) return `${days}d`;
  if (days < 365) return `${(days / 30.4).toFixed(1)}mo`;
  return `${(days / 365).toFixed(1)}y`;
}
