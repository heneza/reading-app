import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: { brand: '#2e5e8c' },
    },
  },
  plugins: [],
};
export default config;
