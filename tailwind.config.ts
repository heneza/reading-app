import type { Config } from 'tailwindcss';

// =====================================================================
// DESIGN TOKENS — change these few values to re-skin the whole app.
// Palette: Blue & periwinkle (soft / pastel).
// =====================================================================
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Page background (soft periwinkle-tinted off-white)
        page: '#f4f7ff',

        // Primary brand blue — used by buttons, links, accents.
        brand: {
          DEFAULT: '#4f86e0', // main blue
          dark: '#3a6fc4',    // hover / pressed
          soft: '#eaf1fc',    // tinted fills & hover backgrounds
        },

        // Periwinkle accent — soft secondary fills.
        periwinkle: {
          DEFAULT: '#a5b4fc',
          soft: '#e8ebff',
        },
      },

      // Use the Inter font loaded in layout.tsx (Claude-like clean sans).
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },

      // Softer corners everywhere (bare `rounded` -> 10px).
      borderRadius: {
        DEFAULT: '0.625rem',
        md: '0.75rem',
        lg: '1rem',
        xl: '1.25rem',
        '2xl': '1.5rem',
      },

      // Gentle card shadow tinted with the brand blue.
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,0.04), 0 6px 20px rgba(79,134,224,0.07)',
      },
    },
  },
  plugins: [],
};
export default config;
