/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        amber: {
          500: 'var(--text-color)',
          600: 'var(--accent-color)',
        },
        zinc: {
          800: 'var(--border-color)',
          900: 'var(--border-color)',
          950: 'var(--panel-bg)',
        },
        black: 'var(--bg-color)',
      }
    },
  },
  plugins: [],
}