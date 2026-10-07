import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: { 50: '#FFFCF5', 100: '#FFF6E5', 200: '#FDEBCB' },
        ink: { 400: '#7A6F63', 600: '#4A4138', 800: '#2B2420', 900: '#1C1714' },
        brick: {
          red: '#E53935',
          yellow: '#FDD835',
          blue: '#1E88E5',
          green: '#43A047',
          orange: '#FB8C00',
          purple: '#8E24AA',
          teal: '#00897B',
          pink: '#D81B60',
          gray: '#78909C',
        },
      },
      fontFamily: {
        sans: ['ui-rounded', '"SF Pro Rounded"', '"Nunito"', '"Segoe UI"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', '"Cascadia Code"', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: {
        chunky: '0 4px 0 rgba(43, 36, 32, 0.15), 0 10px 24px rgba(43, 36, 32, 0.08)',
        pressed: '0 1px 0 rgba(43, 36, 32, 0.15)',
      },
      keyframes: {
        wobble: { '0%, 100%': { transform: 'rotate(-3deg)' }, '50%': { transform: 'rotate(3deg)' } },
        pop: { '0%': { transform: 'scale(0.9)', opacity: '0' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        bounce1: { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-6px)' } },
      },
      animation: {
        wobble: 'wobble 0.4s ease-in-out',
        pop: 'pop 0.18s ease-out',
        hop: 'bounce1 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
