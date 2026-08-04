import theme from './tokens.json';

/** One ramp of the palette — every key exists in both light and dark. */
export type ColorRamp = typeof theme.color.light;
export type ColorToken = keyof ColorRamp;

export const lightColors: ColorRamp = theme.color.light;
export const darkColors: ColorRamp = theme.color.dark;

export type ThemeMode = 'light' | 'dark';

export const colorsFor = (mode: ThemeMode): ColorRamp =>
  mode === 'dark' ? darkColors : lightColors;
