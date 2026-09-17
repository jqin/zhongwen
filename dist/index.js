// src/hanzi.ts
function isHanzi(char) {
  const code = char.codePointAt(0);
  if (code === void 0) return false;
  return code >= 19968 && code <= 40959 || // CJK Unified Ideographs
  code >= 13312 && code <= 19903 || // Extension A
  code >= 63744 && code <= 64255 || // Compatibility Ideographs
  code >= 131072 && code <= 191471;
}
function hasHanzi(text) {
  for (const ch of text) if (isHanzi(ch)) return true;
  return false;
}
function countHanzi(text) {
  let n = 0;
  for (const ch of text) if (isHanzi(ch)) n++;
  return n;
}

// src/pinyin.ts
var TONE_MARKS = {
  a: ["\u0101", "\xE1", "\u01CE", "\xE0", "a"],
  e: ["\u0113", "\xE9", "\u011B", "\xE8", "e"],
  i: ["\u012B", "\xED", "\u01D0", "\xEC", "i"],
  o: ["\u014D", "\xF3", "\u01D2", "\xF2", "o"],
  u: ["\u016B", "\xFA", "\u01D4", "\xF9", "u"],
  \u00FC: ["\u01D6", "\u01D8", "\u01DA", "\u01DC", "\xFC"]
};
function normalizeU(syllable) {
  return syllable.replace("u:", "\xFC").replace(/v(?=[aeiouü]|$)/g, "\xFC");
}
function applyTone(syllable, tone) {
  if (tone === 5) return normalizeU(syllable);
  const idx = tone - 1;
  const s = normalizeU(syllable);
  if (s.includes("a")) return s.replace("a", TONE_MARKS.a[idx]);
  if (s.includes("e")) return s.replace("e", TONE_MARKS.e[idx]);
  if (s.includes("ou")) return s.replace("o", TONE_MARKS.o[idx]);
  for (let i = s.length - 1; i >= 0; i--) {
    const c = s[i];
    if (TONE_MARKS[c]) {
      return s.slice(0, i) + TONE_MARKS[c][idx] + s.slice(i + 1);
    }
  }
  return s;
}
function numberedToMarks(raw) {
  return raw.split(" ").map((syl) => {
    const m = syl.match(/^([a-zA-Züü:]+)([1-5])$/);
    if (!m) return syl.toLowerCase();
    return applyTone(m[1].toLowerCase(), parseInt(m[2], 10));
  }).join(" ");
}
function stripTones(pinyin) {
  return pinyin.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function zipPinyin(text, pinyin) {
  const syl = pinyin.trim().split(/\s+/);
  let i = 0;
  return [...text].map((ch) => isHanzi(ch) ? { c: ch, py: syl[i++] ?? "" } : { c: ch, py: "" });
}

// src/hsk.ts
var hskMap = null;
var loading = null;
var _hskUrl = "/hsk.json";
function setHskUrl(url) {
  _hskUrl = url;
}
function isHskLoaded() {
  return hskMap !== null;
}
function loadHskData(data) {
  hskMap = new Map(Object.entries(data));
}
async function loadHsk() {
  if (hskMap) return;
  if (loading) return loading;
  loading = (async () => {
    try {
      const res = await fetch(_hskUrl);
      if (!res.ok) return;
      const data = await res.json();
      hskMap = new Map(Object.entries(data));
    } catch {
    }
  })();
  return loading;
}
function getHskLevel(word) {
  return hskMap?.get(word) ?? null;
}
var HSK_COLORS = {
  1: "bg-green-500",
  2: "bg-blue-500",
  3: "bg-indigo-500",
  4: "bg-purple-500",
  5: "bg-orange-500",
  6: "bg-red-500"
};

// src/dictionary.ts
var entries = [];
var lookupMap = /* @__PURE__ */ new Map();
var wordSet = /* @__PURE__ */ new Set();
var charIndex = /* @__PURE__ */ new Map();
var charIndexBuilt = false;
var loaded = false;
var loading2 = null;
function isDictionaryLoaded() {
  return loaded;
}
function getWordSet() {
  return wordSet;
}
var _dictionaryUrl = "/cedict.json";
function setDictionaryUrl(url) {
  _dictionaryUrl = url;
}
function ingest(tuples) {
  entries = tuples.map(([simplified, traditional, pinyin, definition]) => ({
    simplified,
    traditional,
    pinyin,
    definition
  }));
  lookupMap = /* @__PURE__ */ new Map();
  wordSet = /* @__PURE__ */ new Set();
  charIndex = /* @__PURE__ */ new Map();
  charIndexBuilt = false;
  for (const entry of entries) {
    const existing = lookupMap.get(entry.simplified);
    if (existing) {
      existing.push(entry);
    } else {
      lookupMap.set(entry.simplified, [entry]);
    }
    wordSet.add(entry.simplified);
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
function loadDictionaryData(tuples) {
  ingest(tuples);
}
async function loadDictionary() {
  if (loaded) return;
  if (loading2) return loading2;
  loading2 = (async () => {
    const res = await fetch(_dictionaryUrl);
    const tuples = await res.json();
    ingest(tuples);
  })();
  return loading2;
}
function ensureCharIndex() {
  if (charIndexBuilt) return;
  charIndex = /* @__PURE__ */ new Map();
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
function getAllWords() {
  return wordSet;
}
var PREFERRED_READINGS = {
  \u4E86: "le",
  \u7684: "de",
  \u5F97: "de",
  \u7740: "zhe",
  \u5417: "ma",
  \u5427: "ba",
  \u5462: "ne",
  \u554A: "a"
};
function entryScore(entry, preferredReading) {
  let score = 0;
  if (preferredReading && entry.pinyin.toLowerCase() === preferredReading) score += 20;
  const plainPinyin = entry.pinyin.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (/^[A-Z]/.test(plainPinyin)) score -= 8;
  if (entry.definition.startsWith("surname ")) score -= 10;
  if (/^(old |archaic )?variant of/i.test(entry.definition)) score -= 5;
  if (/^used in /i.test(entry.definition)) score -= 3;
  score += Math.min(entry.definition.length, 100) / 100;
  return score;
}
function lookupWord(word) {
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
function lookupReadings(word) {
  const results = lookupMap.get(word);
  if (!results || results.length === 0) return [];
  const preferred = PREFERRED_READINGS[word];
  const byReading = /* @__PURE__ */ new Map();
  for (const entry of results) {
    const key = entry.pinyin.toLowerCase();
    const existing = byReading.get(key);
    if (!existing || entryScore(entry, preferred) > entryScore(existing, preferred)) {
      byReading.set(key, entry);
    }
  }
  return [...byReading.values()].sort(
    (a, b) => entryScore(b, preferred) - entryScore(a, preferred)
  );
}
function lookupAll(word) {
  return lookupMap.get(word) || [];
}
function frequencyScore(entry) {
  const def = entry.definition;
  const senses = def.split(/[;/]/).length;
  let score = senses * 10;
  const hsk = getHskLevel(entry.simplified);
  if (hsk) score += (7 - hsk) * 15;
  score += Math.max(0, 5 - entry.simplified.length) * 8;
  score += Math.min(def.length, 200) * 0.05;
  if (def.startsWith("surname ")) score -= 50;
  if (def.startsWith("variant of ") || def.startsWith("old variant of ")) score -= 40;
  if (def.includes("archaic") || def.includes("literary")) score -= 20;
  if (def.includes("dialect") || def.includes("slang")) score -= 10;
  if (def.startsWith("see ") && senses === 1) score -= 30;
  return score;
}
function getRelatedWords(word, limit = 12) {
  if (!word || word.length < 1) return [];
  ensureCharIndex();
  const seen = /* @__PURE__ */ new Set();
  seen.add(word);
  const candidates = [];
  for (const char of word) {
    const charEntries = charIndex.get(char);
    if (!charEntries) continue;
    for (const entry of charEntries) {
      if (seen.has(entry.simplified)) continue;
      seen.add(entry.simplified);
      candidates.push(entry);
    }
  }
  candidates.sort((a, b) => {
    const aShared = [...a.simplified].filter((c) => word.includes(c)).length;
    const bShared = [...b.simplified].filter((c) => word.includes(c)).length;
    if (aShared !== bShared) return bShared - aShared;
    return frequencyScore(b) - frequencyScore(a);
  });
  return candidates.slice(0, limit);
}
function searchDictionary(query, limit = 50) {
  if (!query.trim()) return [];
  const q = query.trim().toLowerCase();
  const isChineseQuery = isHanzi(q[0]);
  if (isChineseQuery) {
    return searchChinese(q, limit);
  } else {
    return searchEnglish(q, limit);
  }
}
function searchChinese(query, limit) {
  const exact = [];
  const prefix = [];
  const contains = [];
  for (const entry of entries) {
    if (entry.simplified === query || entry.traditional === query) {
      exact.push(entry);
    } else if (entry.simplified.startsWith(query) || entry.traditional.startsWith(query)) {
      prefix.push(entry);
    } else if (entry.simplified.includes(query) || entry.traditional.includes(query)) {
      contains.push(entry);
    }
  }
  const sortFn = (a, b) => frequencyScore(b) - frequencyScore(a);
  exact.sort(sortFn);
  prefix.sort(sortFn);
  contains.sort(sortFn);
  return [...exact, ...prefix, ...contains].slice(0, limit);
}
function searchEnglish(query, limit) {
  const exactMatch = [];
  const startsWith = [];
  const contains = [];
  for (const entry of entries) {
    const defLower = entry.definition.toLowerCase();
    const segments = defLower.split(/[;/]/).map((s) => s.trim());
    if (segments.some((s) => s === query)) {
      exactMatch.push(entry);
    } else if (segments.some((s) => s.startsWith(query))) {
      startsWith.push(entry);
    } else if (defLower.includes(query)) {
      contains.push(entry);
    }
  }
  const sortFn = (a, b) => frequencyScore(b) - frequencyScore(a);
  exactMatch.sort(sortFn);
  startsWith.sort(sortFn);
  contains.sort(sortFn);
  return [...exactMatch, ...startsWith, ...contains].slice(0, limit);
}

// src/segment.ts
function greedySegment(text, dict, maxWordLen = 6) {
  const chars = Array.from(text);
  const tokens = [];
  let i = 0;
  while (i < chars.length) {
    if (!isHanzi(chars[i])) {
      let j = i;
      while (j < chars.length && !isHanzi(chars[j])) j++;
      tokens.push({ text: chars.slice(i, j).join(""), value: null, neutral: true });
      i = j;
      continue;
    }
    let matched = false;
    for (let len = Math.min(maxWordLen, chars.length - i); len >= 1; len--) {
      const cand = chars.slice(i, i + len).join("");
      const value = dict.get(cand);
      if (value !== void 0) {
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
var _cutter = null;
function setWordCutter(cutter) {
  _cutter = cutter;
  cache.clear();
  dictWordCache.clear();
}
function greedyCut(text) {
  const words = [];
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
      const cand = chars.slice(i, i + len).join("");
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
var cache = /* @__PURE__ */ new Map();
function tokenizeWords(text) {
  const cut = _cutter ?? greedyCut;
  const words = [];
  for (const token of cut(text)) {
    if (token.length > 0 && isHanzi(token[0]) && (token.length === 1 || lookupWord(token))) {
      words.push(token);
      continue;
    }
    for (const char of token) words.push(char);
  }
  return words;
}
function segmentText(text) {
  const cached = cache.get(text);
  if (cached) return cached;
  const segments = tokenizeWords(text).map((word, i) => {
    const entry = isHanzi(word[0]) ? lookupWord(word) : null;
    return {
      id: `seg-${i}`,
      word,
      traditional: entry?.traditional !== word ? entry?.traditional : void 0,
      pinyin: entry?.pinyin || "",
      definition: entry?.definition || "",
      isKnown: !!entry
    };
  });
  cache.set(text, segments);
  return segments;
}
function knownWordLevel(percent) {
  if (percent >= 80) return "high";
  if (percent >= 50) return "medium";
  return "low";
}
var dictWordCache = /* @__PURE__ */ new Map();
var DICT_WORD_CACHE_MAX = 500;
function dictionaryWords(text) {
  const cached = dictWordCache.get(text);
  if (cached) return cached;
  const words = tokenizeWords(text).filter((w) => isHanzi(w[0]) && !!lookupWord(w));
  if (dictWordCache.size >= DICT_WORD_CACHE_MAX) {
    const oldest = dictWordCache.keys().next().value;
    if (oldest !== void 0) dictWordCache.delete(oldest);
  }
  dictWordCache.set(text, words);
  return words;
}
function getKnownWordStats(text, knownWords) {
  if (!isDictionaryLoaded()) return null;
  const words = dictionaryWords(text);
  if (words.length === 0) return { known: 0, total: 0, percent: 0, level: "low" };
  let known = 0;
  for (const word of words) {
    if (knownWords.has(word)) known++;
  }
  const percent = Math.round(known / words.length * 100);
  return { known, total: words.length, percent, level: knownWordLevel(percent) };
}
function invalidateCache(text) {
  cache.delete(text);
  dictWordCache.delete(text);
}

// src/srs/sm2.ts
function sm2(quality, easeFactor, interval, repetitions) {
  let newEF = easeFactor;
  let newInterval = interval;
  let newReps = repetitions;
  if (quality >= 3) {
    if (newReps === 0) {
      newInterval = 1;
    } else if (newReps === 1) {
      newInterval = 6;
    } else {
      newInterval = Math.round(newInterval * newEF);
    }
    newReps++;
  } else {
    newReps = 0;
    newInterval = 1;
  }
  newEF = newEF + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  newEF = Math.max(1.3, newEF);
  const nextReview = Math.floor(Date.now() / 1e3) + newInterval * 86400;
  return {
    easeFactor: newEF,
    interval: newInterval,
    repetitions: newReps,
    nextReview
  };
}

// src/srs/anki.ts
var MIN_EASE = 1.3;
var START_EASE = 2.5;
var MIN = 60 * 1e3;
var DAY = 24 * 60 * 60 * 1e3;
var LEARNING_STEPS = [1, 10];
var GRADUATE_IVL = 1;
var EASY_IVL = 4;
function newCard(key, now = Date.now()) {
  return { key, due: now, ivl: 0, ease: START_EASE, reps: 0, lapses: 0, state: "learning" };
}
function fuzz(days) {
  if (days < 2) return days;
  const spread = Math.max(1, days * 0.05);
  return days + (Math.random() * 2 - 1) * spread;
}
function applyRating(card, rating, now = Date.now()) {
  const next = { ...card, reps: card.reps + 1 };
  if (card.state === "learning" || card.state === "relearning") {
    const step = Math.min(Math.floor(card.ivl), LEARNING_STEPS.length - 1);
    if (rating === 1) {
      next.ivl = 0;
      next.due = now + LEARNING_STEPS[0] * MIN;
    } else if (rating === 4) {
      next.state = "review";
      next.ivl = EASY_IVL;
      next.due = now + fuzz(EASY_IVL) * DAY;
    } else if (step + 1 < LEARNING_STEPS.length && rating === 2) {
      next.ivl = step;
      next.due = now + LEARNING_STEPS[step] * MIN;
    } else if (step + 1 < LEARNING_STEPS.length) {
      next.ivl = step + 1;
      next.due = now + LEARNING_STEPS[step + 1] * MIN;
    } else {
      next.state = "review";
      next.ivl = GRADUATE_IVL;
      next.due = now + fuzz(GRADUATE_IVL) * DAY;
    }
    return next;
  }
  if (rating === 1) {
    next.state = "relearning";
    next.lapses = card.lapses + 1;
    next.ease = Math.max(MIN_EASE, card.ease - 0.2);
    next.ivl = 0;
    next.due = now + LEARNING_STEPS[1] * MIN;
    return next;
  }
  let ivl;
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
function previewInterval(card, rating) {
  const next = applyRating({ ...card }, rating, Date.now());
  const ms = next.due - Date.now();
  if (ms < 60 * MIN) return `${Math.max(1, Math.round(ms / MIN))}m`;
  if (ms < DAY) return `${Math.round(ms / (60 * MIN))}h`;
  const days = Math.round(ms / DAY);
  if (days < 30) return `${days}d`;
  if (days < 365) return `${(days / 30.4).toFixed(1)}mo`;
  return `${(days / 365).toFixed(1)}y`;
}
export {
  HSK_COLORS,
  MIN_EASE,
  START_EASE,
  applyRating,
  applyTone,
  countHanzi,
  getAllWords,
  getHskLevel,
  getKnownWordStats,
  getRelatedWords,
  getWordSet,
  greedySegment,
  hasHanzi,
  invalidateCache,
  isDictionaryLoaded,
  isHanzi,
  isHskLoaded,
  knownWordLevel,
  loadDictionary,
  loadDictionaryData,
  loadHsk,
  loadHskData,
  lookupAll,
  lookupReadings,
  lookupWord,
  newCard,
  numberedToMarks,
  previewInterval,
  searchDictionary,
  segmentText,
  setDictionaryUrl,
  setHskUrl,
  setWordCutter,
  sm2,
  stripTones,
  zipPinyin
};
