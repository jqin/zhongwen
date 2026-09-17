import { beforeAll, describe, expect, it } from 'vitest';
import {
  loadDictionaryData,
  lookupWord,
  lookupReadings,
  lookupAll,
  searchDictionary,
  getRelatedWords,
  isDictionaryLoaded,
  type DictTuple,
} from '../src/dictionary';
import { loadHskData } from '../src/hsk';

const DATA: DictTuple[] = [
  ['了', '了', 'le', '(completed action marker); (modal particle)'],
  ['了', '了', 'liǎo', 'to finish; to achieve; variant of 瞭'],
  ['好', '好', 'hǎo', 'good; well; proper; to be fond of'],
  ['好', '好', 'hào', 'to be fond of; to have a tendency to'],
  ['你', '你', 'nǐ', 'you (informal)'],
  ['你好', '你好', 'nǐ hǎo', 'hello; hi'],
  ['银行', '銀行', 'yín háng', 'bank; CL:家'],
  ['行', '行', 'xíng', 'to walk; to go; capable'],
  ['张', '張', 'Zhāng', 'surname Zhang'],
  ['张', '張', 'zhāng', 'to open up; classifier for flat objects'],
];

beforeAll(() => {
  loadDictionaryData(DATA);
  loadHskData({ 你: 1, 好: 1, 你好: 1 });
});

describe('dictionary', () => {
  it('loads', () => {
    expect(isDictionaryLoaded()).toBe(true);
  });

  it('prefers the function-word reading for particles', () => {
    expect(lookupWord('了')!.pinyin).toBe('le');
  });

  it('penalizes surnames when picking a primary entry', () => {
    expect(lookupWord('张')!.pinyin).toBe('zhāng');
  });

  it('indexes traditional forms', () => {
    expect(lookupWord('銀行')!.simplified).toBe('银行');
  });

  it('lookupReadings collapses case, keeps tone differences', () => {
    const readings = lookupReadings('好').map(e => e.pinyin);
    expect(readings).toHaveLength(2);
    expect(readings).toContain('hǎo');
    expect(readings).toContain('hào');
    expect(lookupReadings('张')).toHaveLength(1); // Zhāng/zhāng collapse
  });

  it('lookupAll returns every entry', () => {
    expect(lookupAll('了')).toHaveLength(2);
    expect(lookupAll('missing')).toEqual([]);
  });

  it('searches by Chinese with exact before prefix', () => {
    const results = searchDictionary('你');
    expect(results[0].simplified).toBe('你');
    expect(results.map(e => e.simplified)).toContain('你好');
  });

  it('searches by English sense', () => {
    const results = searchDictionary('hello');
    expect(results[0].simplified).toBe('你好');
  });

  it('finds related words by shared character', () => {
    const related = getRelatedWords('行').map(e => e.simplified);
    expect(related).toContain('银行');
  });
});
