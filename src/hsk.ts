/**
 * HSK 3.0 level index. Data shape is the output of `zhongwen-build-hsk`:
 * a flat { word: level } record (levels 1–6).
 *
 * Module-level singleton (loadHsk / getHskLevel / isHskLoaded), so
 * consuming apps can re-export the call surface directly.
 */

let hskMap: Map<string, number> | null = null;
let loading: Promise<void> | null = null;
let _hskUrl = '/hsk.json';

export function setHskUrl(url: string) {
  _hskUrl = url;
}

export function isHskLoaded(): boolean {
  return hskMap !== null;
}

/** Load from a data object directly (bundled JSON) — no fetch. */
export function loadHskData(data: Record<string, number>): void {
  hskMap = new Map(Object.entries(data));
}

export async function loadHsk(): Promise<void> {
  if (hskMap) return;
  if (loading) return loading;

  loading = (async () => {
    try {
      const res = await fetch(_hskUrl);
      if (!res.ok) return;
      const data: Record<string, number> = await res.json();
      hskMap = new Map(Object.entries(data));
    } catch {
      // HSK data is optional — fail silently
    }
  })();

  return loading;
}

export function getHskLevel(word: string): number | null {
  return hskMap?.get(word) ?? null;
}

/** Tailwind badge colors per level, shared so every app renders HSK alike. */
export const HSK_COLORS: Record<number, string> = {
  1: 'bg-green-500',
  2: 'bg-blue-500',
  3: 'bg-indigo-500',
  4: 'bg-purple-500',
  5: 'bg-orange-500',
  6: 'bg-red-500',
};
