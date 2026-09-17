import { isHanzi } from './hanzi';
import { lookupWord, isDictionaryLoaded } from './dictionary';

/**
 * Segmentation: a dependency-free greedy longest-match tokenizer, a
 * dictionary-aware segmenter with pluggable word-splitting (so an app can
 * inject jieba or any other cutter), and known-word statistics.
 */

// ── Greedy longest-match ─────────────────────────────────────────────────────

export interface GreedyToken<T> {
  text: string;
  /** The dictionary value matched, or null when no word matched. */
  value: T | null;
  /** punctuation / digits / latin — grouped into one token, ignored for stats */
  neutral: boolean;
}

/**
 * Greedy longest-match segmentation against a word → value map. Consecutive
 * non-Han characters group into a single neutral token; unmatched Han
 * characters come back one per token with `value: null`.
 */
export function greedySegment<T>(
  text: string,
  dict: Map<string, T>,
  maxWordLen = 6,
): GreedyToken<T>[] {
  const chars = Array.from(text);
  const tokens: GreedyToken<T>[] = [];
  let i = 0;
  while (i < chars.length) {
    if (!isHanzi(chars[i])) {
      let j = i;
      while (j < chars.length && !isHanzi(chars[j])) j++;
      tokens.push({ text: chars.slice(i, j).join(''), value: null, neutral: true });
      i = j;
      continue;
    }
    let matched = false;
    for (let len = Math.min(maxWordLen, chars.length - i); len >= 1; len--) {
      const cand = chars.slice(i, i + len).join('');
      const value = dict.get(cand);
      if (value !== undefined) {
        tokens.push({ text: cand, value, neutral: false });
        i += len;
        matched = true;
        break;
      }
    }
    if (!matched) {
      tokens.push({ text: chars[i], value: null, neutral: false });
      i += 1;
    }
  }
  return tokens;
}

// ── Dictionary-backed segmenter ──────────────────────────────────────────────

export interface WordSegment {
  id: string;
  word: string;
  traditional?: string;
  pinyin: string;
  definition: string;
  isKnown: boolean; // has dictionary entry
}

/** A word cutter: splits raw text into candidate tokens (e.g. jieba's cut). */
export type WordCutter = (text: string) => string[];

let _cutter: WordCutter | null = null;

/**
 * Install the word cutter used by segmentText/getKnownWordStats — e.g.
 * inject jieba-wasm here. Without one, a greedy longest-match against the
 * loaded CEDICT dictionary is used.
 */
export function setWordCutter(cutter: WordCutter | null): void {
  _cutter = cutter;
  cache.clear();
  dictWordCache.clear();
}

function greedyCut(text: string): string[] {
  const words: string[] = [];
  const chars = Array.from(text);
  let i = 0;
  while (i < chars.length) {
    if (!isHanzi(chars[i])) {
      words.push(chars[i]);
      i++;
      continue;
    }
    let matched = false;
    for (let len = Math.min(6, chars.length - i); len >= 2; len--) {
      const cand = chars.slice(i, i + len).join('');
      if (lookupWord(cand)) {
        words.push(cand);
        i += len;
        matched = true;
        break;
      }
    }
    if (!matched) {
      words.push(chars[i]);
      i++;
    }
  }
  return words;
}

// Cache for segmentation results
const cache = new Map<string, WordSegment[]>();

// The word boundaries a text is read at: the cutter's tokens, except that a
// multi-character token missing from the dictionary (e.g. "這段" = 這 + 段, a
// real demonstrative + measure word but not a fixed entry) falls back to its
// characters, so a bad boundary guess doesn't hide words the reader knows.
// Non-Chinese runs come back one character at a time.
function tokenizeWords(text: string): string[] {
  const cut = _cutter ?? greedyCut;
  const words: string[] = [];
  for (const token of cut(text)) {
    if (token.length > 0 && isHanzi(token[0]) && (token.length === 1 || lookupWord(token))) {
      words.push(token);
      continue;
    }
    for (const char of token) words.push(char);
  }
  return words;
}

export function segmentText(text: string): WordSegment[] {
  const cached = cache.get(text);
  if (cached) return cached;

  const segments: WordSegment[] = tokenizeWords(text).map((word, i) => {
    const entry = isHanzi(word[0]) ? lookupWord(word) : null;
    return {
      id: `seg-${i}`,
      word,
      traditional: entry?.traditional !== word ? entry?.traditional : undefined,
      pinyin: entry?.pinyin || '',
      definition: entry?.definition || '',
      isKnown: !!entry,
    };
  });

  cache.set(text, segments);
  return segments;
}

/**
 * Difficulty band for a text, from the reader's side:
 * - `low`    — under half the words known: heavy going, expect to look a lot up
 * - `medium` — most words known, enough gaps to still be work
 * - `high`   — reads comfortably, unknown words are the exception
 *
 * Web and mobile both colour the percentage from this, so the thresholds
 * live here and the two stay in step.
 */
export type KnownWordLevel = 'low' | 'medium' | 'high';

export function knownWordLevel(percent: number): KnownWordLevel {
  if (percent >= 80) return 'high';
  if (percent >= 50) return 'medium';
  return 'low';
}

export interface KnownWordStats {
  known: number;
  total: number;
  percent: number; // 0–100, rounded
  level: KnownWordLevel;
}

// Dictionary words of a text, in order. Derived from the text alone, so it
// stays valid as the reader's known set changes — only the counting pass in
// getKnownWordStats re-runs.
const dictWordCache = new Map<string, string[]>();
const DICT_WORD_CACHE_MAX = 500;

function dictionaryWords(text: string): string[] {
  const cached = dictWordCache.get(text);
  if (cached) return cached;

  const words = tokenizeWords(text).filter(w => isHanzi(w[0]) && !!lookupWord(w));
  if (dictWordCache.size >= DICT_WORD_CACHE_MAX) {
    // Oldest insertion first — enough to keep a large library from growing
    // this cache without bound while scrolling.
    const oldest = dictWordCache.keys().next().value;
    if (oldest !== undefined) dictWordCache.delete(oldest);
  }
  dictWordCache.set(text, words);
  return words;
}

/**
 * How much of a text the reader already knows, counted the way the lesson
 * screen counts it: over dictionary words only (punctuation, digits and Latin
 * text don't count), per token, so a word weighs as often as it appears.
 *
 * Returns null until the dictionary is loaded — before that every lookup
 * misses and any text would score a misleading 0%.
 */
export function getKnownWordStats(text: string, knownWords: Set<string>): KnownWordStats | null {
  if (!isDictionaryLoaded()) return null;

  const words = dictionaryWords(text);
  if (words.length === 0) return { known: 0, total: 0, percent: 0, level: 'low' };

  let known = 0;
  for (const word of words) {
    if (knownWords.has(word)) known++;
  }
  const percent = Math.round((known / words.length) * 100);
  return { known, total: words.length, percent, level: knownWordLevel(percent) };
}

export function invalidateCache(text: string): void {
  cache.delete(text);
  dictWordCache.delete(text);
}
