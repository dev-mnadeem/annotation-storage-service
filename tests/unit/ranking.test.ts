import { describe, expect, it } from 'vitest';
import { rankByArea } from '../../src/domain/ranking';

describe('rankByArea', () => {
  it('orders the largest mask first', () => {
    const ranked = rankByArea([{ area: 10 }, { area: 30 }, { area: 20 }]);
    expect(ranked.map((r) => r.item.area)).toEqual([30, 20, 10]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it('gives tied areas the same rank and skips the places they consumed', () => {
    const ranked = rankByArea([{ area: 50 }, { area: 50 }, { area: 10 }]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 1, 3]);
  });

  it('handles an empty image', () => {
    expect(rankByArea([])).toEqual([]);
  });

  it('does not mutate its input', () => {
    const input = [{ area: 1 }, { area: 9 }];
    rankByArea(input);
    expect(input.map((i) => i.area)).toEqual([1, 9]);
  });
});
