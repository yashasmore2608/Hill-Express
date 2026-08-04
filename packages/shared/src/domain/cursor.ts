/**
 * Keyset cursor helpers — OFFSET is banned repo-wide (O(n) scans). Cursors
 * encode the last row's sort keys; page N+1 costs the same as page 1 forever.
 *
 * Encoding is URI-escaped JSON — pure ECMAScript, so this file runs
 * unchanged on Hermes, Node, and browsers (shared has no platform deps).
 */

export interface NameIdCursor {
  n: string; // last name
  i: string; // last id (tiebreaker)
}

export const encodeCursor = (c: NameIdCursor): string =>
  encodeURIComponent(JSON.stringify(c));

export const decodeCursor = (raw: string): NameIdCursor | null => {
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as NameIdCursor;
    return typeof parsed.n === 'string' && typeof parsed.i === 'string' ? parsed : null;
  } catch {
    return null;
  }
};
