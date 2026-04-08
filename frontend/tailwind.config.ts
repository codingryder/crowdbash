import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0A0C10',
        surface: '#111418',
        surface2: '#181C23',
        surface3: '#1E232D',
        gold: '#F4B940',
        'gold-dim': 'rgba(244,185,64,0.12)',
        fangreen: '#3DD68C',
        fanred: '#F05A5A',
        fanblue: '#4A9EFF',
        fanpurple: '#8B6FFF',
      },
      fontFamily: {
        syne: ['Syne', 'sans-serif'],
        dm: ['DM Sans', 'sans-serif'],
      },
      borderColor: {
        DEFAULT: 'rgba(255,255,255,0.07)',
      },
    },
  },
  plugins: [],
} satisfies Config;
