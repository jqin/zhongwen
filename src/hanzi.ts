/**
 * Han-character utilities shared by every consumer.
 *
 * Detection covers the CJK Unified Ideographs block plus Extension A and the
 * compatibility block — a superset of the ad-hoc checks this replaced
 * (0x4E00–0x9FFF alone, or the 㐀-鿿 range).
 */

export function isHanzi(char: string): boolean {
  const code = char.codePointAt(0);
  if (code === undefined) return false;
  return (
    (code >= 0x4e00 && code <= 0x9fff) || // CJK Unified Ideographs
    (code >= 0x3400 && code <= 0x4dbf) || // Extension A
    (code >= 0xf900 && code <= 0xfaff) || // Compatibility Ideographs
    (code >= 0x20000 && code <= 0x2ebef) // Extensions B–F
  );
}

export function hasHanzi(text: string): boolean {
  for (const ch of text) if (isHanzi(ch)) return true;
  return false;
}

/** Number of Han characters in a string (code-point aware). */
export function countHanzi(text: string): number {
  let n = 0;
  for (const ch of text) if (isHanzi(ch)) n++;
  return n;
}
