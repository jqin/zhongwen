#!/usr/bin/env node
/**
 * Downloads the HSK 3.0 word list and builds { "word": level } JSON
 * (levels 1–6) — the input format for @jqin/zhongwen's loadHsk().
 * Source: https://github.com/andycburke/HSK-3.0-Word-List
 *
 * Usage: zhongwen-build-hsk [out-path]   (default: ./hsk.json)
 */
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import path from 'node:path';

const OUT_PATH = path.resolve(process.argv[2] ?? 'hsk.json');
const CSV_URL =
  'https://raw.githubusercontent.com/andycburke/HSK-3.0-Word-List/main/HSK-3.0-Word-List.csv';

console.log('Downloading HSK 3.0 word list…');
const res = await fetch(CSV_URL);
if (!res.ok) throw new Error(`HTTP ${res.status}`);
const csv = await res.text();

const hskMap = {};
const levelCounts = {};
for (const line of csv.split('\n').slice(1)) {
  if (!line.trim()) continue;
  const cols = line.split(',');
  const level = parseInt(cols[0], 10);
  const hanzi = cols[3]?.trim();

  if (!hanzi || isNaN(level) || level < 1 || level > 6) continue;

  // Only keep first occurrence (lower level takes priority)
  if (!hskMap[hanzi]) {
    hskMap[hanzi] = level;
    levelCounts[level] = (levelCounts[level] || 0) + 1;
  }

  // Also add alternate forms
  const alt = cols[4]?.trim();
  if (alt && !hskMap[alt]) {
    hskMap[alt] = level;
  }
}

for (let i = 1; i <= 6; i++) {
  console.log(`  HSK ${i}: ${levelCounts[i] || 0} words`);
}

mkdirSync(path.dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, JSON.stringify(hskMap));
const size = statSync(OUT_PATH).size;
console.log(`Done! ${OUT_PATH} is ${(size / 1024).toFixed(1)} KB (${Object.keys(hskMap).length} words)`);
