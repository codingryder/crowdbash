import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#1a1b1e',
        bg2: '#212226',
        surface: '#26272b',
        surface2: '#2e3035',
        surface3: '#343639',
        green: '#2dd67a',
        green2: '#4aeb8f',
        amber: '#f59e0b',
        amber2: '#fbbf24',
        red: '#f05252',
        blue: '#3b82f6',
        purple: '#8b5cf6',
        tx: '#f0f0f0',
        tx2: '#c0c2c8',
        muted: 'rgba(192,194,200,0.55)',
        faint: 'rgba(192,194,200,0.1)',
      },
      fontFamily: {
        cabinet: ['Cabinet Grotesk', 'sans-serif'],
        instrument: ['Instrument Sans', 'sans-serif'],
      },
      borderRadius: {
        card: '14px',
        btn: '9px',
        lg: '20px',
      },
      borderColor: {
        DEFAULT: 'rgba(255,255,255,0.07)',
      },
    },
  },
  plugins: [],
} satisfies Config;
