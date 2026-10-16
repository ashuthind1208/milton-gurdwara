const defaultColors = require('tailwindcss/colors');
const toRgbTriplet = (hex) => [0, 2, 4].map((index) => parseInt(hex.replace('#', '').slice(index, index + 2), 16)).join(' ');
const themedPalette = (name) => Object.fromEntries(Object.entries(defaultColors[name]).map(([shade, hex]) => [shade, `rgb(var(--theme-${shade}-rgb, ${toRgbTriplet(hex)}) / <alpha-value>)`]));

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        blue: themedPalette('blue'),
        sky: themedPalette('sky'),
        cyan: themedPalette('cyan'),
        indigo: themedPalette('indigo'),
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
        heading: ['var(--font-heading, "Crimson Text")', 'serif'],
        body: ['var(--font-body, "Manrope")', 'sans-serif'],
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

