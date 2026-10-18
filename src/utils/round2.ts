/**
 * Round a monetary value to 2 decimal places (cents).
 *
 * `Number.EPSILON` nudges values that are *just* below the rounding
 * boundary (e.g. 1.0049999999999999 caused by float arithmetic)
 * so they round the way a human expects (1.005 → 1.01).
 */
export const round2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;
