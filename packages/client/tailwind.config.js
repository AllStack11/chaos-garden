/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{svelte,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        garden: {
          bg: '#0a0d14',
          surface: 'rgba(15, 23, 42, 0.75)',
          border: 'rgba(51, 65, 85, 0.5)',
          loam: '#1a1410',
          forest: '#0f2b1d',
          plant: '#10b981',
          herbivore: '#06b6d4',
          carnivore: '#f43f5e',
          fungus: '#a855f7',
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};

