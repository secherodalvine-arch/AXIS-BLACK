/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#f0f4fa',
          100: '#d9e3f4',
          200: '#b3c8e8',
          300: '#8dacd9',
          400: '#6790cc',
          500: '#4174be',
          600: '#2a5c99',
          700: '#1a3a5c',
          800: '#112240',
          900: '#080f1a',
          950: '#040810',
        },
        gold: {
          300: '#e8c97a',
          400: '#d4aa4a',
          500: '#c9a96e',
          600: '#b8903a',
        },
        cyan: {
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
        },
        lilac: {
          300: '#cebdff',
          400: '#a78bfa',
          500: '#8b5cf6',
        }
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};
