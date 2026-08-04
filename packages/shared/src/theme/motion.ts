import theme from './tokens.json';

/**
 * Motion vocabulary — three springs, five durations, three easings.
 *
 * THE RULE: if a finger caused it, use a spring. If the system caused it,
 * use a duration. `pop` is the only spring allowed to overshoot, so an
 * overshoot in this app always means "something good happened".
 */
export const springs = theme.motion.springs;
export const durations = theme.motion.durations;

/** Cubic-bezier control points, ready for Reanimated's Easing.bezier(...). */
export const easings = theme.motion.easings as Record<
  'enter' | 'exit' | 'standard',
  [number, number, number, number]
>;

export type SpringName = keyof typeof springs;
export type DurationName = keyof typeof durations;
