/** Same preset as the mobile apps — one token file drives all four surfaces. */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  presets: [require('@hillexpress/shared/tailwind-preset')],
  // Driven by the toggle's data-theme stamp, NOT the OS. `media` would have
  // meant the toggle swapped CSS variables while every `dark:` utility kept
  // following the system setting — half the page flipping.
  darkMode: ['selector', '[data-theme="dark"]'],
};
