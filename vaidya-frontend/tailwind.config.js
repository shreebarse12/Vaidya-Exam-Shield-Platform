/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      animation: {
        'shimmer': 'shimmer 1.5s ease-in-out infinite',
      },
      keyframes: {
        shimmer: {
          '0%':   { opacity: '0.5' },
          '50%':  { opacity: '1' },
          '100%': { opacity: '0.5' },
        },
      },
    },
  },
  plugins: [],
}