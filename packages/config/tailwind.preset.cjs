/**
 * Shared Tailwind preset for TerraMap apps.
 * Apps extend this via `presets: [require('@terramap/config/tailwind')]`
 * and supply their own `content` globs.
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#16a34a',
          dark: '#15803d',
        },
      },
    },
  },
  plugins: [],
};
