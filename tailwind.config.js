/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          saffron: 'rgb(var(--brand-saffron-rgb, 244 163 0) / <alpha-value>)',
          blue: 'rgb(var(--brand-blue-rgb, 11 78 162) / <alpha-value>)',
          cream: 'rgb(var(--brand-cream-rgb, 255 248 232) / <alpha-value>)',
          navy: 'rgb(var(--brand-navy-rgb, 29 53 87) / <alpha-value>)',
          gold: 'rgb(var(--brand-gold-rgb, 200 155 60) / <alpha-value>)',
          green: '#2E8B57',
          error: '#D32F2F'
        }
      },
      fontFamily: {
        heading: ['Crimson Text', 'serif'],
        body: ['Manrope', 'sans-serif'],
        gurmukhi: ['Noto Sans Gurmukhi', 'sans-serif']
      },
      boxShadow: {
        soft: '0 8px 30px rgba(15, 23, 42, 0.08)'
      }
    }
  },
  plugins: [],
  darkMode: 'class'
};

