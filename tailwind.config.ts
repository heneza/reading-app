import type { Config } from 'tailwindcss';

// =====================================================================
// DESIGN TOKENS — change these few values to re-skin the whole app.
// Palette: deep red / burgundy on warm off-white.
// =====================================================================
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Page background (warm off-white so the deep red pops)
        page: '#f7f4f2',

        // Primary brand — deep red / burgundy.
        brand: {
          DEFAULT: '#8a1730', // main deep red
          dark: '#6b1126',    // hover / pressed
          soft: '#f6e9ec',    // tinted fills & hover backgrounds
        },

        // Soft rose accent — focus rings & subtle highlights.
        accent: {
          DEFAULT: '#cf9aa6',
          soft: '#f3e4e7',
        },
      },

      // Bookish serif (Claude-style), loaded in layout.tsx.
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-serif', 'Georgia', 'Cambria', 'serif'],
      },

      // Softer corners everywhere (bare `rounded` -> 10px).
      borderRadius: {
        DEFAULT: '0.625rem',
        md: '0.75rem',
        lg: '1rem',
        xl: '1.25rem',
        '2xl': '1.5rem',
      },

      // Gentle card shadow tinted with the brand red.
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,0.04), 0 6px 20px rgba(138,23,48,0.07)',
      },
    },
  },
  plugins: [],
};
export default config;
