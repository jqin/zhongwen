import { describe, expect, it } from 'vitest';
import { sm2 } from '../src/srs/sm2';
import { applyRating, newCard, previewInterval, START_EASE, MIN_EASE } from '../src/srs/anki';

describe('sm2', () => {
  it('graduates 1 → 6 → interval*EF on correct answers', () => {
    let r = sm2(5, 2.5, 0, 0);
    expect(r.interval).toBe(1);
    expect(r.repetitions).toBe(1);
    r = sm2(5, r.easeFactor, r.interval, r.repetitions);
    expect(r.interval).toBe(6);
    r = sm2(4, r.easeFactor, r.interval, r.repetitions);
    expect(r.interval).toBeGreaterThan(6);
  });

  it('resets on failure and floors ease at 1.3', () => {
    const r = sm2(0, 1.3, 30, 5);
    expect(r.interval).toBe(1);
    expect(r.repetitions).toBe(0);
    expect(r.easeFactor).toBe(1.3);
  });

  it('stamps a future review time', () => {
    const r = sm2(5, 2.5, 0, 0);
    expect(r.nextReview).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });
});

describe('anki scheduler', () => {
  const NOW = 1_700_000_000_000;

  it('creates learning cards due now', () => {
    const card = newCard('w:你好', NOW);
    expect(card.state).toBe('learning');
    expect(card.due).toBe(NOW);
    expect(card.ease).toBe(START_EASE);
  });

  it('walks the learning steps on Good and graduates', () => {
    let card = newCard('k', NOW);
    card = applyRating(card, 3, NOW); // step 0 → step 1 (10m)
    expect(card.state).toBe('learning');
    expect(card.due).toBe(NOW + 10 * 60 * 1000);
    card = applyRating(card, 3, NOW); // graduates
    expect(card.state).toBe('review');
    expect(card.ivl).toBe(1);
  });

  it('Easy jumps straight to review at 4 days', () => {
    const card = applyRating(newCard('k', NOW), 4, NOW);
    expect(card.state).toBe('review');
    expect(card.ivl).toBe(4);
  });

  it('Again on a review card lapses to relearning and drops ease', () => {
    let card = applyRating(newCard('k', NOW), 4, NOW);
    card = applyRating(card, 1, NOW);
    expect(card.state).toBe('relearning');
    expect(card.lapses).toBe(1);
    expect(card.ease).toBeCloseTo(START_EASE - 0.2);
  });

  it('ease never drops below the floor', () => {
    let card = applyRating(newCard('k', NOW), 4, NOW);
    for (let i = 0; i < 20; i++) {
      card = applyRating(card, 1, NOW); // lapse
      card = applyRating(card, 4, NOW); // back to review
    }
    expect(card.ease).toBeGreaterThanOrEqual(MIN_EASE);
  });

  it('previewInterval renders human labels', () => {
    const card = newCard('k');
    expect(previewInterval(card, 1)).toBe('1m');
    expect(previewInterval(card, 4)).toMatch(/^\dd$/);
  });
});
