import { describe, expect, it } from 'vitest';
import { newGame } from './riffs';
import { G } from './core';

describe('reel riffs', () => {
  it('a classic magazine plays the reel’s 8 shells in order, ending with the boss', () => {
    for (let i = 0; i < 50; i++) {
      newGame(8, 4);
      expect(G.shells.map(s => s.style)).toEqual(['sq', 'lcg', 'tri', 'reese', 'mirror', 'poly', 'shep', 'boss']);
      expect(G.mag.reduce((a, b) => a + b, 0)).toBe(4);
    }
  });
  it('shell 1 is n² mod 8 (values 0, 1, 4) and shell 2 visits every value once', () => {
    newGame(8, 4);
    const v1 = new Set(G.shells[0].n.map(q => q.lab));
    expect([...v1].every(v => [0, 1, 4].includes(v as number))).toBe(true);
    const v2 = G.shells[1].n.slice(0, 8).map(q => q.lab).sort();
    expect(v2).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });
  it('every riff note is inside the 2 bars before the trigger', () => {
    for (let i = 0; i < 20; i++) {
      newGame(8, 4);
      for (const sh of G.shells) for (const q of sh.n) { expect(q.s).toBeGreaterThanOrEqual(0); expect(q.s + q.d).toBeLessThanOrEqual(32); }
    }
  });
  it('short magazines keep reel order', () => {
    const order = ['sq', 'lcg', 'tri', 'reese', 'mirror', 'poly', 'shep'];
    for (let i = 0; i < 50; i++) {
      newGame(4, 2);
      const ids = G.shells.slice(0, -1).map(s => order.indexOf(s.style));
      expect([...ids].sort((a, b) => a - b)).toEqual(ids);
    }
  });
});
