#!/usr/bin/env node
/**
 * Downloads CC-CEDICT and builds a compact JSON dictionary:
 * an array of [simplified, traditional, pinyin, definition] tuples —
 * the input format for @jqin/zhongwen's loadDictionary().
 *
 * Usage: zhongwen-build-cedict [out-path]   (default: ./cedict.json)
 */
import { gunzipSync } from 'node:zlib';
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { numberedToMarks } from '../dist/index.js';

const OUT_PATH = path.resolve(process.argv[2] ?? 'cedict.json');
const CEDICT_URL = 'https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz';

function parseLine(line) {
  if (!line || line.startsWith('#')) return null;
  const m = line.match(/^(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+\/(.+)\/\s*$/);
  if (!m) return null;
  const [, traditional, simplified, rawPinyin, defs] = m;
  return [simplified, traditional, numberedToMarks(rawPinyin), defs.replace(/\//g, '; ')];
}

console.log('Downloading CC-CEDICT…');
const res = await fetch(CEDICT_URL);
if (!res.ok) throw new Error(`HTTP ${res.status}`);
const compressed = Buffer.from(await res.arrayBuffer());

console.log(`Downloaded ${(compressed.length / 1024 / 1024).toFixed(1)} MB, decompressing…`);
const text = gunzipSync(compressed).toString('utf8');

console.log('Parsing entries…');
const entries = [];
for (const line of text.split('\n')) {
  const entry = parseLine(line.trim());
  if (entry) entries.push(entry);
}
console.log(`Parsed ${entries.length} entries`);

mkdirSync(path.dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, JSON.stringify(entries));

const size = statSync(OUT_PATH).size;
console.log(`Done! ${OUT_PATH} is ${(size / 1024 / 1024).toFixed(1)} MB (${entries.length} entries)`);
