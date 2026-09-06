/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        charcoal: {
          950: '#0a0a0b',
          900: '#111113',
          850: '#161618',
          800: '#1c1c1f',
          750: '#222226',
          700: '#2a2a2e',
          600: '#38383d',
          500: '#4a4a50',
          400: '#6b6b72',
          300: '#8e8e96',
          200: '#b4b4ba',
          100: '#d4d4d8',
        },
        graphite: {
          900: '#1a1a1c',
          800: '#242427',
          700: '#2e2e32',
          600: '#3a3a3f',
          500: '#4c4c52',
        },
        sage: {
          900: '#3a4a3a',
          800: '#4a5d4a',
          700: '#5a705a',
          600: '#6b856b',
          500: '#8b9a6b',
          400: '#a3b585',
          300: '#c0d0a0',
          200: '#dde8c4',
          100: '#eef5e0',
        },
        accent: {
          DEFAULT: '#8b9a6b',
          warm: '#c4a97d',
          cool: '#7a8fa3',
        },
        cream: {
          DEFAULT: '#f0ebe3',
          muted: '#c8c4bc',
          dim: '#9a968f',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Instrument Serif', 'Georgia', 'serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      backdropBlur: {
        xs: '2px',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'glow-pulse': 'glowPulse 3s ease-in-out infinite',
        'light-sweep': 'lightSweep 2s ease-in-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 12px rgba(139, 154, 107, 0.08)' },
          '50%': { boxShadow: '0 0 20px rgba(139, 154, 107, 0.15)' },
        },
        lightSweep: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(200%)' },
        },
      },
    },
  },
  plugins: [],
};
