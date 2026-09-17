import { beforeAll, afterEach, describe, expect, it } from 'vitest';
import {
  greedySegment,
  segmentText,
  setWordCutter,
  getKnownWordStats,
  knownWordLevel,
  invalidateCache,
} from '../src/segment';
import { loadDictionaryData, type DictTuple } from '../src/dictionary';

const DATA: DictTuple[] = [
  ['你', '你', 'nǐ', 'you'],
  ['好', '好', 'hǎo', 'good'],
  ['你好', '你好', 'nǐ hǎo', 'hello'],
  ['中国', '中國', 'zhōng guó', 'China'],
  ['中', '中', 'zhōng', 'middle'],
  ['国', '國', 'guó', 'country'],
  ['人', '人', 'rén', 'person'],
  ['中国人', '中國人', 'zhōng guó rén', 'Chinese person'],
];

beforeAll(() => {
  loadDictionaryData(DATA);
});

afterEach(() => {
  setWordCutter(null);
});

describe('greedySegment', () => {
  const dict = new Map<string, number>([
    ['你好', 0],
    ['你', 1],
    ['中国', 2],
  ]);

  it('prefers the longest match', () => {
    const tokens = greedySegment('你好中国', dict);
    expect(tokens.map(t => t.text)).toEqual(['你好', '中国']);
    expect(tokens[0].value).toBe(0);
  });

  it('groups non-hanzi runs into one neutral token', () => {
    const tokens = greedySegment('你好, world! 中国', dict);
    expect(tokens).toEqual([
      { text: '你好', value: 0, neutral: false },
      { text: ', world! ', value: null, neutral: true },
      { text: '中国', value: 2, neutral: false },
    ]);
  });

  it('falls back to single chars for unmatched hanzi', () => {
    const tokens = greedySegment('人', dict);
    expect(tokens).toEqual([{ text: '人', value: null, neutral: false }]);
  });
});

describe('segmentText (built-in greedy cutter)', () => {
  it('segments against the loaded dictionary, longest match first', () => {
    invalidateCache('中国人你好');
    const segs = segmentText('中国人你好');
    expect(segs.map(s => s.word)).toEqual(['中国人', '你好']);
    expect(segs[0].pinyin).toBe('zhōng guó rén');
    expect(segs.every(s => s.isKnown)).toBe(true);
  });
});

describe('segmentText (injected cutter)', () => {
  it('uses the cutter but splits unknown multi-char tokens into chars', () => {
    // A "jieba" that produces one dictionary word and one non-word token
    setWordCutter(() => ['你好', '中人']);
    const segs = segmentText('你好中人');
    expect(segs.map(s => s.word)).toEqual(['你好', '中', '人']);
  });
});

describe('known-word stats', () => {
  it('bands percentages', () => {
    expect(knownWordLevel(85)).toBe('high');
    expect(knownWordLevel(60)).toBe('medium');
    expect(knownWordLevel(10)).toBe('low');
  });

  it('counts per token over dictionary words only', () => {
    invalidateCache('你好中国！abc');
    const stats = getKnownWordStats('你好中国！abc', new Set(['你好']))!;
    expect(stats.total).toBe(2); // 你好 + 中国; punctuation/latin excluded
    expect(stats.known).toBe(1);
    expect(stats.percent).toBe(50);
    expect(stats.level).toBe('medium');
  });
});
