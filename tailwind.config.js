/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        soil: '#1B1A17',
        canopy: '#20281F',
        bark: '#2E2A22',
        parchment: '#EFE9DD',
        husk: '#B8AD97',
        harvest: '#C9A227',
        leaf: '#5C7A52',
        rust: '#A85C32',
      },
      fontFamily: {
        display: ['"Fraunces"', 'serif'],
        body: ['"Inter"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};
