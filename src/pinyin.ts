import { isHanzi } from './hanzi';

/**
 * Pinyin utilities: numbered → tone-mark conversion (CC-CEDICT style input),
 * diacritic stripping, and hanzi↔pinyin zipping.
 */

const TONE_MARKS: Record<string, string[]> = {
  a: ['ā', 'á', 'ǎ', 'à', 'a'],
  e: ['ē', 'é', 'ě', 'è', 'e'],
  i: ['ī', 'í', 'ǐ', 'ì', 'i'],
  o: ['ō', 'ó', 'ǒ', 'ò', 'o'],
  u: ['ū', 'ú', 'ǔ', 'ù', 'u'],
  ü: ['ǖ', 'ǘ', 'ǚ', 'ǜ', 'ü'],
};

function normalizeU(syllable: string): string {
  return syllable.replace('u:', 'ü').replace(/v(?=[aeiouü]|$)/g, 'ü');
}

/**
 * Apply a tone (1–5) to a bare syllable, placing the mark per standard rules:
 * a/e always take it, ou marks the o, otherwise the last vowel.
 */
export function applyTone(syllable: string, tone: number): string {
  if (tone === 5) return normalizeU(syllable);
  const idx = tone - 1;
  const s = normalizeU(syllable);

  if (s.includes('a')) return s.replace('a', TONE_MARKS.a[idx]);
  if (s.includes('e')) return s.replace('e', TONE_MARKS.e[idx]);
  if (s.includes('ou')) return s.replace('o', TONE_MARKS.o[idx]);
  for (let i = s.length - 1; i >= 0; i--) {
    const c = s[i];
    if (TONE_MARKS[c]) {
      return s.slice(0, i) + TONE_MARKS[c][idx] + s.slice(i + 1);
    }
  }
  return s;
}

/**
 * Convert space-separated numbered pinyin ("ni3 hao3") to tone marks
 * ("nǐ hǎo"). Unmatched tokens pass through lowercased, matching the
 * CC-CEDICT build pipeline this was extracted from.
 */
export function numberedToMarks(raw: string): string {
  return raw
    .split(' ')
    .map((syl) => {
      const m = syl.match(/^([a-zA-Züü:]+)([1-5])$/);
      if (!m) return syl.toLowerCase();
      return applyTone(m[1].toLowerCase(), parseInt(m[2], 10));
    })
    .join(' ');
}

/** Remove tone diacritics: "nǐ hǎo" → "ni hao". */
export function stripTones(pinyin: string): string {
  return pinyin.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export interface CharPinyin {
  c: string;
  py: string;
}

/**
 * Pair each Han character of `text` with its syllable from the
 * space-separated pinyin string. Punctuation and non-Han characters get an
 * empty syllable.
 */
export function zipPinyin(text: string, pinyin: string): CharPinyin[] {
  const syl = pinyin.trim().split(/\s+/);
  let i = 0;
  return [...text].map((ch) => (isHanzi(ch) ? { c: ch, py: syl[i++] ?? '' } : { c: ch, py: '' }));
}
