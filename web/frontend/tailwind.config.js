/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Warm color palette
        primary: {
          50: '#fef7ed',
          100: '#fdedd3',
          200: '#fad7a6',
          300: '#f6bb6e',
          400: '#f19635',
          500: '#ee7a12',
          600: '#df5f09',
          700: '#b8460a',
          800: '#923810',
          900: '#762f10',
        },
        warm: {
          50: '#faf8f5',
          100: '#f3efe8',
          200: '#e6ddd0',
          300: '#d5c4ad',
          400: '#c2a789',
          500: '#b3906d',
          600: '#a67d5d',
          700: '#8a654e',
          800: '#715444',
          900: '#5d463a',
        }
      }
    },
  },
  plugins: [],
}
