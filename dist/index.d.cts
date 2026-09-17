/**
 * Han-character utilities shared by every consumer.
 *
 * Detection covers the CJK Unified Ideographs block plus Extension A and the
 * compatibility block — a superset of the ad-hoc checks this replaced
 * (0x4E00–0x9FFF alone, or the 㐀-鿿 range).
 */
declare function isHanzi(char: string): boolean;
declare function hasHanzi(text: string): boolean;
/** Number of Han characters in a string (code-point aware). */
declare function countHanzi(text: string): number;

/**
 * Apply a tone (1–5) to a bare syllable, placing the mark per standard rules:
 * a/e always take it, ou marks the o, otherwise the last vowel.
 */
declare function applyTone(syllable: string, tone: number): string;
/**
 * Convert space-separated numbered pinyin ("ni3 hao3") to tone marks
 * ("nǐ hǎo"). Unmatched tokens pass through lowercased, matching the
 * CC-CEDICT build pipeline this was extracted from.
 */
declare function numberedToMarks(raw: string): string;
/** Remove tone diacritics: "nǐ hǎo" → "ni hao". */
declare function stripTones(pinyin: string): string;
interface CharPinyin {
    c: string;
    py: string;
}
/**
 * Pair each Han character of `text` with its syllable from the
 * space-separated pinyin string. Punctuation and non-Han characters get an
 * empty syllable.
 */
declare function zipPinyin(text: string, pinyin: string): CharPinyin[];

/**
 * CC-CEDICT dictionary: loading, primary-reading selection, search, and
 * related-word discovery. Data shape is the output of `zhongwen-build-cedict`:
 * an array of [simplified, traditional, pinyin, definition] tuples.
 *
 * Module-level singleton (one dictionary per app), so consuming apps can
 * re-export the call surface directly.
 */
interface DictEntry {
    simplified: string;
    traditional: string;
    pinyin: string;
    definition: string;
}
type DictTuple = [string, string, string, string];
declare function isDictionaryLoaded(): boolean;
declare function getWordSet(): Set<string>;
declare function setDictionaryUrl(url: string): void;
/** Load from tuples directly (bundled or pre-fetched data) — no fetch. */
declare function loadDictionaryData(tuples: DictTuple[]): void;
declare function loadDictionary(): Promise<void>;
declare function getAllWords(): Set<string>;
/**
 * Look up a word's primary entry — the reading most likely intended in
 * running text (see entryScore). For polyphonic words the other readings are
 * available via lookupReadings().
 */
declare function lookupWord(word: string): DictEntry | null;
/**
 * All distinct pronunciations of a word, best-ranked first, one entry per
 * reading. Tone differences count as distinct readings (好 hǎo/hào); case
 * does not (张 zhāng/Zhāng collapse to one).
 */
declare function lookupReadings(word: string): DictEntry[];
/**
 * Look up all entries for a word.
 */
declare function lookupAll(word: string): DictEntry[];
/**
 * Find words related to the given word by shared characters.
 * Returns words that share at least one character, sorted by relevance.
 */
declare function getRelatedWords(word: string, limit?: number): DictEntry[];
/**
 * Search dictionary by Chinese or English query.
 */
declare function searchDictionary(query: string, limit?: number): DictEntry[];

/**
 * HSK 3.0 level index. Data shape is the output of `zhongwen-build-hsk`:
 * a flat { word: level } record (levels 1–6).
 *
 * Module-level singleton (loadHsk / getHskLevel / isHskLoaded), so
 * consuming apps can re-export the call surface directly.
 */
declare function setHskUrl(url: string): void;
declare function isHskLoaded(): boolean;
/** Load from a data object directly (bundled JSON) — no fetch. */
declare function loadHskData(data: Record<string, number>): void;
declare function loadHsk(): Promise<void>;
declare function getHskLevel(word: string): number | null;
/** Tailwind badge colors per level, shared so every app renders HSK alike. */
declare const HSK_COLORS: Record<number, string>;

/**
 * Segmentation: a dependency-free greedy longest-match tokenizer, a
 * dictionary-aware segmenter with pluggable word-splitting (so an app can
 * inject jieba or any other cutter), and known-word statistics.
 */
interface GreedyToken<T> {
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
declare function greedySegment<T>(text: string, dict: Map<string, T>, maxWordLen?: number): GreedyToken<T>[];
interface WordSegment {
    id: string;
    word: string;
    traditional?: string;
    pinyin: string;
    definition: string;
    isKnown: boolean;
}
/** A word cutter: splits raw text into candidate tokens (e.g. jieba's cut). */
type WordCutter = (text: string) => string[];
/**
 * Install the word cutter used by segmentText/getKnownWordStats — e.g.
 * inject jieba-wasm here. Without one, a greedy longest-match against the
 * loaded CEDICT dictionary is used.
 */
declare function setWordCutter(cutter: WordCutter | null): void;
declare function segmentText(text: string): WordSegment[];
/**
 * Difficulty band for a text, from the reader's side:
 * - `low`    — under half the words known: heavy going, expect to look a lot up
 * - `medium` — most words known, enough gaps to still be work
 * - `high`   — reads comfortably, unknown words are the exception
 *
 * Web and mobile both colour the percentage from this, so the thresholds
 * live here and the two stay in step.
 */
type KnownWordLevel = 'low' | 'medium' | 'high';
declare function knownWordLevel(percent: number): KnownWordLevel;
interface KnownWordStats {
    known: number;
    total: number;
    percent: number;
    level: KnownWordLevel;
}
/**
 * How much of a text the reader already knows, counted the way the lesson
 * screen counts it: over dictionary words only (punctuation, digits and Latin
 * text don't count), per token, so a word weighs as often as it appears.
 *
 * Returns null until the dictionary is loaded — before that every lookup
 * misses and any text would score a misleading 0%.
 */
declare function getKnownWordStats(text: string, knownWords: Set<string>): KnownWordStats | null;
declare function invalidateCache(text: string): void;

/**
 * Classic SM-2 spaced repetition.
 */
interface SRSResult {
    easeFactor: number;
    interval: number;
    repetitions: number;
    nextReview: number;
}
/**
 * SM-2 spaced repetition algorithm.
 * @param quality - 0-5 rating (0=complete fail, 5=perfect)
 * @param easeFactor - current ease factor (starts at 2.5)
 * @param interval - current interval in days
 * @param repetitions - number of correct reviews
 */
declare function sm2(quality: number, easeFactor: number, interval: number, repetitions: number): SRSResult;

/**
 * Simplified Anki-style SM-2 scheduler with learning steps.
 * Ratings: 1 Again · 2 Hard · 3 Good · 4 Easy.
 */
type CardState = {
    key: string;
    due: number;
    ivl: number;
    ease: number;
    reps: number;
    lapses: number;
    state: 'learning' | 'review' | 'relearning';
};
declare const MIN_EASE = 1.3;
declare const START_EASE = 2.5;
declare function newCard(key: string, now?: number): CardState;
declare function applyRating(card: CardState, rating: 1 | 2 | 3 | 4, now?: number): CardState;
/** Human label for the interval a rating would produce, e.g. "10m", "3d". */
declare function previewInterval(card: CardState, rating: 1 | 2 | 3 | 4): string;

export { type CardState, type CharPinyin, type DictEntry, type DictTuple, type GreedyToken, HSK_COLORS, type KnownWordLevel, type KnownWordStats, MIN_EASE, type SRSResult, START_EASE, type WordCutter, type WordSegment, applyRating, applyTone, countHanzi, getAllWords, getHskLevel, getKnownWordStats, getRelatedWords, getWordSet, greedySegment, hasHanzi, invalidateCache, isDictionaryLoaded, isHanzi, isHskLoaded, knownWordLevel, loadDictionary, loadDictionaryData, loadHsk, loadHskData, lookupAll, lookupReadings, lookupWord, newCard, numberedToMarks, previewInterval, searchDictionary, segmentText, setDictionaryUrl, setHskUrl, setWordCutter, sm2, stripTones, zipPinyin };
