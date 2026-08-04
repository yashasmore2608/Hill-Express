/**
 * Hill Express Tailwind preset — generated FROM theme.json, the single source of truth.
 * Consumed by all three Expo apps (via NativeWind) and the admin PWA.
 *
 * Usage in tailwind.config.js:
 *   presets: [require('@hillexpress/shared/tailwind-preset')]
 *
 * Dark values are exposed as `<name>-dark` so NativeWind/Tailwind `dark:` variants
 * can target them explicitly: `bg-ground dark:bg-ground-dark`.
 */
const theme = require('./src/theme/tokens.json');

const light = theme.color.light;
const dark = theme.color.dark;

const colors = {};
for (const key of Object.keys(light)) {
  colors[kebab(key)] = { DEFAULT: light[key], dark: dark[key] };
}

function kebab(s) {
  return s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

const spacing = {};
theme.space.forEach((px, i) => {
  spacing[i] = `${px}px`;
});

module.exports = {
  theme: {
    extend: {
      colors,
      spacing,
      borderRadius: {
        s: `${theme.radius.s}px`,
        m: `${theme.radius.m}px`,
        l: `${theme.radius.l}px`,
        pill: `${theme.radius.pill}px`,
      },
      fontFamily: {
        sans: ['PlusJakartaSans', 'system-ui', 'sans-serif'],
      },
      transitionDuration: Object.fromEntries(
        Object.entries(theme.motion.durations).map(([k, v]) => [k, `${v}ms`]),
      ),
      transitionTimingFunction: Object.fromEntries(
        Object.entries(theme.motion.easings).map(([k, v]) => [k, `cubic-bezier(${v.join(',')})`]),
      ),
    },
  },
};
