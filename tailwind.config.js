/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          saffron: '#F4A300',
          blue: '#0B4EA2',
          cream: '#FFF8E8',
          navy: '#1D3557',
          gold: '#C89B3C',
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

