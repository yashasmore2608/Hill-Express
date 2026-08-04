import theme from './tokens.json';

/**
 * The ten type tokens. Every size is a multiple of 2 and every line-height a
 * multiple of 4 so text always lands on the 4pt grid. Anything not on this
 * list does not get built.
 *
 * Weights are strings because RN's fontWeight accepts numeric strings and the
 * variable font (PlusJakartaSans 200–800) resolves them on-axis.
 */
export interface TypeToken {
  size: number;
  lineHeight: number;
  /** letterSpacing in px (RN units) */
  tracking: number;
  weight: string;
  uppercase?: boolean;
  /** Prices, ETAs, quantities — anything that must not reflow when digits change. */
  tabular?: boolean;
}

export type TypeTokenName = keyof typeof theme.type;

export const typeScale = theme.type as Record<TypeTokenName, TypeToken>;

/**
 * Android maps weights to FONT FILES, not a numeric axis — so each weight
 * bucket resolves to a named static face loaded by useAppFonts(). Setting
 * fontWeight alongside a custom family risks fake-bolding on Android, so the
 * family name carries the weight and fontWeight is deliberately absent.
 */
const weightToFamily = (weight: string): string => {
  const w = Number(weight);
  if (w >= 800) return 'PlusJakartaSans-ExtraBold';
  if (w >= 700) return 'PlusJakartaSans-Bold';
  if (w >= 600) return 'PlusJakartaSans-SemiBold';
  if (w >= 500) return 'PlusJakartaSans-Medium';
  return 'PlusJakartaSans-Regular';
};

/**
 * Convert a token to a RN TextStyle-shaped object.
 * (Returned as a plain object so shared stays free of react-native imports.)
 */
export const textStyle = (name: TypeTokenName) => {
  const t = typeScale[name];
  return {
    fontFamily: weightToFamily(t.weight),
    fontSize: t.size,
    lineHeight: t.lineHeight,
    letterSpacing: t.tracking,
    ...(t.uppercase ? { textTransform: 'uppercase' as const } : {}),
    ...(t.tabular ? { fontVariant: ['tabular-nums' as const] } : {}),
  };
};
