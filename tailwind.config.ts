import type { Config } from 'tailwindcss';

// =====================================================================
// DESIGN TOKENS — change these few values to re-skin the whole app.
// Palette: cinematic — burgundy crimson on a dark, gradient-lit canvas.
// (Layout/structure is untouched; only what the colours MEAN changed.)
// =====================================================================

// One dark neutral ramp shared by `stone` and `slate`: low numbers are
// dark (backgrounds, borders), high numbers are light (text). The app uses
// low numbers for fills and high numbers for text, so this inverts cleanly.
const neutral = {
  50: '#100c0d',
  100: '#181314',
  200: '#241e1f',
  300: '#352d2e',
  400: '#867b71',
  500: '#a89d93',
  600: '#c3b9af',
  700: '#ddd4ca',
  800: '#ece3d9',
  900: '#f6eee5',
};

const red = {
  50: '#2b1118',
  100: '#3a151f',
  200: '#551d2b',
  300: '#7f293c',
  400: '#b9344b',
  500: '#d84a60',
  600: '#f36f82',
  700: '#ff9baa',
  800: '#ffc4cc',
  900: '#ffe4e8',
};

const amber = {
  50: '#21170d',
  100: '#32220f',
  200: '#4a3215',
  300: '#6f4a1d',
  400: '#9c6928',
  500: '#c99040',
  600: '#e2ad5d',
  700: '#f3ca85',
  800: '#ffe2ae',
  900: '#fff2d7',
};

const green = {
  50: '#0d2119',
  100: '#113124',
  200: '#194734',
  300: '#24654b',
  400: '#318865',
  500: '#4bad83',
  600: '#72cba2',
  700: '#9be0c0',
  800: '#c4f0dc',
  900: '#e5faf1',
};

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Dark page canvas (gradient glow is added in globals.css).
        page: '#0b0809',

        // Primary brand — burgundy red shared with the original light mode.
        brand: {
          DEFAULT: '#a51f36',
          dark: '#7f1429',
          soft: '#271116', // dark wine fill for tags & hovers
        },

        accent: {
          DEFAULT: '#cf9aa6',
          soft: '#3a2026',
        },

        stone: neutral,
        slate: neutral,
        red,
        amber,
        green,
      },

      fontFamily: {
        sans: ['var(--font-sans)', 'ui-serif', 'Georgia', 'Cambria', 'serif'],
      },

      borderRadius: {
        DEFAULT: '0.625rem',
        md: '0.75rem',
        lg: '1rem',
        xl: '1.25rem',
        '2xl': '1.5rem',
      },

      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.3), 0 10px 30px -12px rgba(0,0,0,0.6)',
      },
    },
  },
  plugins: [],
};
export default config;
