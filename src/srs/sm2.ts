/**
 * Classic SM-2 spaced repetition.
 */

export interface SRSResult {
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReview: number; // unix timestamp (seconds)
}

/**
 * SM-2 spaced repetition algorithm.
 * @param quality - 0-5 rating (0=complete fail, 5=perfect)
 * @param easeFactor - current ease factor (starts at 2.5)
 * @param interval - current interval in days
 * @param repetitions - number of correct reviews
 */
export function sm2(
  quality: number,
  easeFactor: number,
  interval: number,
  repetitions: number
): SRSResult {
  let newEF = easeFactor;
  let newInterval = interval;
  let newReps = repetitions;

  if (quality >= 3) {
    // Correct response
    if (newReps === 0) {
      newInterval = 1;
    } else if (newReps === 1) {
      newInterval = 6;
    } else {
      newInterval = Math.round(newInterval * newEF);
    }
    newReps++;
  } else {
    // Incorrect response
    newReps = 0;
    newInterval = 1;
  }

  // Update ease factor
  newEF = newEF + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  newEF = Math.max(1.3, newEF);

  const nextReview = Math.floor(Date.now() / 1000) + newInterval * 86400;

  return {
    easeFactor: newEF,
    interval: newInterval,
    repetitions: newReps,
    nextReview,
  };
}
