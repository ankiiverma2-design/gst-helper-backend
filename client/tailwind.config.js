/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef7ff',
          100: '#d9edff',
          500: '#1170e4',
          600: '#0d5cc0',
          700: '#0b4b9c',
        },
      },
    },
  },
  plugins: [],
};
