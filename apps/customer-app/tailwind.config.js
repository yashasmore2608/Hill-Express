/** Tokens come from packages/shared/theme.json via the preset — never hardcode here. */
module.exports = {
  content: ['./src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset'), require('@hillexpress/shared/tailwind-preset')],
  darkMode: 'media',
};
