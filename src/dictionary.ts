import { getHskLevel } from './hsk';
import { isHanzi } from './hanzi';

/**
 * CC-CEDICT dictionary: loading, primary-reading selection, search, and
 * related-word discovery. Data shape is the output of `zhongwen-build-cedict`:
 * an array of [simplified, traditional, pinyin, definition] tuples.
 *
 * Module-level singleton (one dictionary per app), so consuming apps can
 * re-export the call surface directly.
 */

export interface DictEntry {
  simplified: string;
  traditional: string;
  pinyin: string;
  definition: string;
}

export type DictTuple = [string, string, string, string];

// Module-level cache
let entries: DictEntry[] = [];
let lookupMap: Map<string, DictEntry[]> = new Map();
let wordSet: Set<string> = new Set();
let charIndex: Map<string, DictEntry[]> = new Map(); // character → entries containing it
let charIndexBuilt = false;
let loaded = false;
let loading: Promise<void> | null = null;

export function isDictionaryLoaded(): boolean {
  return loaded;
}

export function getWordSet(): Set<string> {
  return wordSet;
}

let _dictionaryUrl = '/cedict.json';

export function setDictionaryUrl(url: string) {
  _dictionaryUrl = url;
}

function ingest(tuples: DictTuple[]): void {
  entries = tuples.map(([simplified, traditional, pinyin, definition]) => ({
    simplified,
    traditional,
    pinyin,
    definition,
  }));

  lookupMap = new Map();
  wordSet = new Set();
  charIndex = new Map();
  charIndexBuilt = false;

  for (const entry of entries) {
    // Index by simplified
    const existing = lookupMap.get(entry.simplified);
    if (existing) {
      existing.push(entry);
    } else {
      lookupMap.set(entry.simplified, [entry]);
    }
    wordSet.add(entry.simplified);

    // Also index by traditional if different
    if (entry.traditional !== entry.simplified) {
      const existingTrad = lookupMap.get(entry.traditional);
      if (existingTrad) {
        existingTrad.push(entry);
      } else {
        lookupMap.set(entry.traditional, [entry]);
      }
      wordSet.add(entry.traditional);
    }
  }

  loaded = true;
}

/** Load from tuples directly (bundled or pre-fetched data) — no fetch. */
export function loadDictionaryData(tuples: DictTuple[]): void {
  ingest(tuples);
}

export async function loadDictionary(): Promise<void> {
  if (loaded) return;
  if (loading) return loading;

  loading = (async () => {
    const res = await fetch(_dictionaryUrl);
    const tuples: DictTuple[] = await res.json();
    ingest(tuples);
  })();

  return loading;
}

/**
 * Build the character → entries index on demand. Only the "related words"
 * feature needs it, so we skip it during the initial load to keep the main
 * thread free, and build it lazily on first use.
 */
function ensureCharIndex(): void {
  if (charIndexBuilt) return;
  charIndex = new Map();
  for (const entry of entries) {
    if (entry.simplified.length >= 2) {
      for (const char of entry.simplified) {
        const charEntries = charIndex.get(char);
        if (charEntries) {
          charEntries.push(entry);
        } else {
          charIndex.set(char, [entry]);
        }
      }
    }
  }
  charIndexBuilt = true;
}

export function getAllWords(): Set<string> {
  return wordSet;
}

// Polyphonic characters (多音字) whose standalone reading in running text is
// almost always the function-word one. Segmenters resolve most polyphony by
// producing multi-character words (行为 xíngwéi vs 银行 yínháng), but these
// particles surface as single-character tokens where "longest definition"
// picks the wrong entry (e.g. 了 liǎo "to finish" over the aspect particle
// le). Genuinely ambiguous standalone characters (地 dì/de) are deliberately
// not listed — for those the UI shows all readings instead of guessing.
const PREFERRED_READINGS: Record<string, string> = {
  了: 'le',
  的: 'de',
  得: 'de',
  着: 'zhe',
  吗: 'ma',
  吧: 'ba',
  呢: 'ne',
  啊: 'a',
};

// Rank a dictionary entry as the "primary" reading of its word: prefer the
// known function-word reading, penalize proper nouns (capitalized pinyin),
// surnames, and variant cross-references, and break ties toward the richer
// definition.
function entryScore(entry: DictEntry, preferredReading?: string): number {
  let score = 0;
  if (preferredReading && entry.pinyin.toLowerCase() === preferredReading) score += 20;
  const plainPinyin = entry.pinyin.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/^[A-Z]/.test(plainPinyin)) score -= 8;
  if (entry.definition.startsWith('surname ')) score -= 10;
  if (/^(old |archaic )?variant of/i.test(entry.definition)) score -= 5;
  if (/^used in /i.test(entry.definition)) score -= 3;
  score += Math.min(entry.definition.length, 100) / 100;
  return score;
}

/**
 * Look up a word's primary entry — the reading most likely intended in
 * running text (see entryScore). For polyphonic words the other readings are
 * available via lookupReadings().
 */
export function lookupWord(word: string): DictEntry | null {
  const results = lookupMap.get(word);
  if (!results || results.length === 0) return null;

  const preferred = PREFERRED_READINGS[word];
  let best = results[0];
  let bestScore = -Infinity;
  for (const entry of results) {
    const score = entryScore(entry, preferred);
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }
  return best;
}

/**
 * All distinct pronunciations of a word, best-ranked first, one entry per
 * reading. Tone differences count as distinct readings (好 hǎo/hào); case
 * does not (张 zhāng/Zhāng collapse to one).
 */
export function lookupReadings(word: string): DictEntry[] {
  const results = lookupMap.get(word);
  if (!results || results.length === 0) return [];

  const preferred = PREFERRED_READINGS[word];
  const byReading = new Map<string, DictEntry>();
  for (const entry of results) {
    const key = entry.pinyin.toLowerCase();
    const existing = byReading.get(key);
    if (!existing || entryScore(entry, preferred) > entryScore(existing, preferred)) {
      byReading.set(key, entry);
    }
  }
  return [...byReading.values()].sort(
    (a, b) => entryScore(b, preferred) - entryScore(a, preferred),
  );
}

/**
 * Look up all entries for a word.
 */
export function lookupAll(word: string): DictEntry[] {
  return lookupMap.get(word) || [];
}

/**
 * Frequency score for ranking search results (higher = more common).
 * Uses multiple heuristics since CC-CEDICT has no frequency data:
 *  - Number of definition senses (more meanings → more common)
 *  - Word length (shorter → more common)
 *  - Surname/variant/archaic penalties
 *  - Definition detail (longer definitions → better documented → more common)
 */
function frequencyScore(entry: DictEntry): number {
  const def = entry.definition;
  const senses = def.split(/[;/]/).length;
  let score = senses * 10;

  // HSK words are known to be common — big boost, lower levels more common
  const hsk = getHskLevel(entry.simplified);
  if (hsk) score += (7 - hsk) * 15;

  // Shorter words are generally more common
  score += Math.max(0, 5 - entry.simplified.length) * 8;

  // Longer definitions = better documented = likely more common
  score += Math.min(def.length, 200) * 0.05;

  // Penalties for less common entries
  if (def.startsWith('surname ')) score -= 50;
  if (def.startsWith('variant of ') || def.startsWith('old variant of ')) score -= 40;
  if (def.includes('archaic') || def.includes('literary')) score -= 20;
  if (def.includes('dialect') || def.includes('slang')) score -= 10;
  if (def.startsWith('see ') && senses === 1) score -= 30; // cross-references

  return score;
}

/**
 * Find words related to the given word by shared characters.
 * Returns words that share at least one character, sorted by relevance.
 */
export function getRelatedWords(word: string, limit = 12): DictEntry[] {
  if (!word || word.length < 1) return [];

  ensureCharIndex();

  const seen = new Set<string>();
  seen.add(word); // exclude the word itself
  const candidates: DictEntry[] = [];

  for (const char of word) {
    const charEntries = charIndex.get(char);
    if (!charEntries) continue;
    for (const entry of charEntries) {
      if (seen.has(entry.simplified)) continue;
      seen.add(entry.simplified);
      candidates.push(entry);
    }
  }

  // Score: shared characters + frequency
  candidates.sort((a, b) => {
    const aShared = [...a.simplified].filter(c => word.includes(c)).length;
    const bShared = [...b.simplified].filter(c => word.includes(c)).length;
    if (aShared !== bShared) return bShared - aShared;
    return frequencyScore(b) - frequencyScore(a);
  });

  return candidates.slice(0, limit);
}

/**
 * Search dictionary by Chinese or English query.
 */
export function searchDictionary(query: string, limit = 50): DictEntry[] {
  if (!query.trim()) return [];

  const q = query.trim().toLowerCase();
  const isChineseQuery = isHanzi(q[0]);

  if (isChineseQuery) {
    return searchChinese(q, limit);
  } else {
    return searchEnglish(q, limit);
  }
}

function searchChinese(query: string, limit: number): DictEntry[] {
  const exact: DictEntry[] = [];
  const prefix: DictEntry[] = [];
  const contains: DictEntry[] = [];

  for (const entry of entries) {
    if (entry.simplified === query || entry.traditional === query) {
      exact.push(entry);
    } else if (entry.simplified.startsWith(query) || entry.traditional.startsWith(query)) {
      prefix.push(entry);
    } else if (entry.simplified.includes(query) || entry.traditional.includes(query)) {
      contains.push(entry);
    }
  }

  const sortFn = (a: DictEntry, b: DictEntry) => frequencyScore(b) - frequencyScore(a);

  exact.sort(sortFn);
  prefix.sort(sortFn);
  contains.sort(sortFn);

  return [...exact, ...prefix, ...contains].slice(0, limit);
}

function searchEnglish(query: string, limit: number): DictEntry[] {
  const exactMatch: DictEntry[] = [];
  const startsWith: DictEntry[] = [];
  const contains: DictEntry[] = [];

  for (const entry of entries) {
    const defLower = entry.definition.toLowerCase();
    const segments = defLower.split(/[;/]/).map(s => s.trim());
    // Exact sense match (a definition segment is exactly the query)
    if (segments.some(s => s === query)) {
      exactMatch.push(entry);
    } else if (segments.some(s => s.startsWith(query))) {
      startsWith.push(entry);
    } else if (defLower.includes(query)) {
      contains.push(entry);
    }
  }

  const sortFn = (a: DictEntry, b: DictEntry) => frequencyScore(b) - frequencyScore(a);

  exactMatch.sort(sortFn);
  startsWith.sort(sortFn);
  contains.sort(sortFn);

  return [...exactMatch, ...startsWith, ...contains].slice(0, limit);
}
