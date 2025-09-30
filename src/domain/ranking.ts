/**
 * Competition ranking by mask area, largest first: the biggest mask on an image is rank 1,
 * equal areas share a rank, and the rank after a tie of n skips n - 1 places.
 *
 * `GET /annotations/:id/rank` answers this for one mask with two indexed counts.
 * `GET /images/:id/masks` answers it for a whole image in one pass, which is what a client
 * showing a ranked mask list actually needs — the alternative is one request per mask.
 */
export interface Ranked<T> {
  item: T;
  rank: number;
}

export function rankByArea<T extends { area: number }>(items: T[]): Ranked<T>[] {
  const sorted = [...items].sort((a, b) => b.area - a.area);
  const out: Ranked<T>[] = [];
  let lastArea = Number.NaN;
  let lastRank = 0;
  sorted.forEach((item, index) => {
    if (item.area !== lastArea) {
      lastRank = index + 1;
      lastArea = item.area;
    }
    out.push({ item, rank: lastRank });
  });
  return out;
}
