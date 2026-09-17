import { describe, expect, it } from 'vitest';
import { applyTone, numberedToMarks, stripTones, zipPinyin } from '../src/pinyin';
import { countHanzi, hasHanzi, isHanzi } from '../src/hanzi';

describe('hanzi', () => {
  it('detects Han characters across blocks', () => {
    expect(isHanzi('中')).toBe(true);
    expect(isHanzi('㐀')).toBe(true); // Extension A
    expect(isHanzi('a')).toBe(false);
    expect(isHanzi('。')).toBe(false);
    expect(isHanzi('1')).toBe(false);
  });

  it('counts and detects in mixed text', () => {
    expect(countHanzi('我有2只cat。')).toBe(3);
    expect(hasHanzi('hello')).toBe(false);
    expect(hasHanzi('hello 世界')).toBe(true);
  });
});

describe('applyTone', () => {
  it('marks a and e first', () => {
    expect(applyTone('hao', 3)).toBe('hǎo');
    expect(applyTone('lei', 4)).toBe('lèi');
  });

  it('marks o in ou', () => {
    expect(applyTone('gou', 3)).toBe('gǒu');
  });

  it('marks last vowel otherwise', () => {
    expect(applyTone('liu', 2)).toBe('liú');
    expect(applyTone('gui', 4)).toBe('guì');
  });

  it('handles ü spellings', () => {
    expect(applyTone('nu:', 3)).toBe('nǚ');
    expect(applyTone('lv', 4)).toBe('lǜ');
  });

  it('neutral tone gets no mark', () => {
    expect(applyTone('ma', 5)).toBe('ma');
  });
});

describe('numberedToMarks', () => {
  it('converts CC-CEDICT style strings', () => {
    expect(numberedToMarks('ni3 hao3')).toBe('nǐ hǎo');
    expect(numberedToMarks('Zhong1 guo2')).toBe('zhōng guó');
  });

  it('passes through unmatched tokens lowercased', () => {
    expect(numberedToMarks('A B C')).toBe('a b c');
  });
});

describe('stripTones', () => {
  it('removes diacritics', () => {
    expect(stripTones('nǐ hǎo')).toBe('ni hao');
    expect(stripTones('lǜ')).toBe('lü'.normalize('NFD').replace(/[̀-ͯ]/g, ''));
  });
});

describe('zipPinyin', () => {
  it('pairs hanzi with syllables, skipping punctuation', () => {
    expect(zipPinyin('你好！', 'nǐ hǎo')).toEqual([
      { c: '你', py: 'nǐ' },
      { c: '好', py: 'hǎo' },
      { c: '！', py: '' },
    ]);
  });

  it('pads missing syllables with empty strings', () => {
    expect(zipPinyin('你好', 'nǐ')).toEqual([
      { c: '你', py: 'nǐ' },
      { c: '好', py: '' },
    ]);
  });
});
