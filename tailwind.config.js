/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        jarvis: {
          50: '#e0f7ff',
          100: '#b3ecff',
          200: '#80dfff',
          300: '#4dd3ff',
          400: '#1ac7ff',
          500: '#00b8e6',
          600: '#0099bf',
          700: '#007a99',
          800: '#005c73',
          900: '#003d4d',
          glow: '#00d4ff',
        },
        dark: {
          900: '#02060a',
          800: '#040b12',
          700: '#061119',
          600: '#0a1822',
          500: '#0e2030',
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
        display: ['"Orbitron"', 'sans-serif'],
      },
      animation: {
        'spin-slow': 'spin 20s linear infinite',
        'spin-reverse': 'spin-reverse 15s linear infinite',
        'pulse-ring': 'pulse-ring 3s ease-out infinite',
        'flicker': 'flicker 4s linear infinite',
        'scan': 'scan 3s ease-in-out infinite',
        'fade-in': 'fade-in 0.5s ease-out',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
      },
      keyframes: {
        'spin-reverse': {
          '0%': { transform: 'rotate(360deg)' },
          '100%': { transform: 'rotate(0deg)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.8)', opacity: '0.8' },
          '100%': { transform: 'scale(2.4)', opacity: '0' },
        },
        'flicker': {
          '0%, 100%': { opacity: '1' },
          '48%': { opacity: '1' },
          '49%': { opacity: '0.4' },
          '50%': { opacity: '1' },
          '52%': { opacity: '0.8' },
          '53%': { opacity: '1' },
        },
        'scan': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(100%)' },
        },
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(0, 212, 255, 0.4)' },
          '50%': { boxShadow: '0 0 40px rgba(0, 212, 255, 0.8)' },
        },
      },
    },
  },
  plugins: [],
};
