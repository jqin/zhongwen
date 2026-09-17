# 中文 zhongwen

Chinese-language toolkit for web and React Native apps: CC-CEDICT dictionary,
word segmentation, pinyin utilities, HSK levels, spaced repetition, and
text-to-speech.

## Install

Consumed as a git dependency — `dist/` is committed so installs need no build
step:

```jsonc
// package.json
"dependencies": {
  "@jqin/zhongwen": "github:jqin/zhongwen"
}
```

Pin to a commit for reproducible builds: `github:jqin/zhongwen#<sha>`.

## Modules

| Import | What's there |
|---|---|
| `@jqin/zhongwen` | Everything below except TTS |
| — `hanzi` | `isHanzi` / `hasHanzi` / `countHanzi` (CJK basic + ext-A/B+ + compat) |
| — `pinyin` | `numberedToMarks` (`ni3 hao3` → `nǐ hǎo`), `applyTone`, `stripTones`, `zipPinyin` |
| — `dictionary` | CC-CEDICT singleton: `loadDictionary()` / `loadDictionaryData()`, `lookupWord` (polyphone-aware primary reading), `lookupReadings`, `searchDictionary` (Chinese + English), `getRelatedWords` |
| — `segment` | `greedySegment` (longest-match, dependency-free), `segmentText` with an injectable `setWordCutter` (plug in jieba), `getKnownWordStats` / `knownWordLevel` |
| — `hsk` | HSK 3.0 level index: `loadHsk()` / `loadHskData()`, `getHskLevel`, `HSK_COLORS` |
| — `srs/sm2` | Classic SM-2 (`sm2(quality, ease, interval, reps)`) |
| — `srs/anki` | Anki-style scheduler with learning steps (`newCard`, `applyRating`, `previewInterval`) |
| `@jqin/zhongwen/tts-web` | Web Speech API TTS: `speak(text, {voice, rate, onBoundary})` → Promise, `speakSlow`, `stop`, `isSpeaking`. SSR-safe. |
| `@jqin/zhongwen/tts-expo` | expo-speech TTS: `speak`, `speakSlow`, `stop`. Needs the `expo-speech` peer. |

## Data

Apps host their own dictionary/HSK JSON (it's ~10 MB); the package ships the
build scripts that produce it:

```bash
npx zhongwen-build-cedict public/cedict.json   # CC-CEDICT → [s, t, pinyin, def][] tuples
npx zhongwen-build-hsk    public/hsk.json      # HSK 3.0 → { word: level }
```

Load with `setDictionaryUrl('/cedict.json'); await loadDictionary()` (fetch),
or `loadDictionaryData(tuples)` / `loadHskData(map)` for bundled data.

## Developing

```bash
pnpm install
pnpm test        # vitest
pnpm typecheck
pnpm build       # tsup → dist/ (ESM + CJS + d.ts)
```

**`dist/` is committed on purpose** — consumers install from git, so rebuild
and commit `dist/` in the same commit as any `src/` change:

```bash
pnpm build && git add -A && git commit
```

## License

MIT. Dictionary data built by the scripts comes from
[CC-CEDICT](https://cc-cedict.org/) (CC BY-SA 4.0) and the
[HSK 3.0 word list](https://github.com/andycburke/HSK-3.0-Word-List).
