import { describe, it, expect } from 'vitest';
import { round2 } from '../src/utils/round2';

describe('round2', () => {
  it('rounds money to cents', () => {
    expect(round2(149.9985)).toBe(150);
    expect(round2(3149.9685)).toBe(3149.97);
    expect(round2(4.347825)).toBe(4.35);
    expect(round2(64.317825)).toBe(64.32);
    expect(round2(20)).toBe(20);
    expect(round2(0)).toBe(0);
  });

  it('rounds half-up at the boundary instead of down (EPSILON guard)', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(0.1 + 0.2)).toBe(0.3); // classic float artifact
  });
});
