/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['Georgia', 'Cambria', '"Times New Roman"', 'Times', 'serif'],
      },
      colors: {
        navy: {
          900: '#0f2347',
          800: '#163161',
          700: '#1e4280',
        },
        gold: {
          500: '#c59b27',
          600: '#a67f17',
          300: '#e6ca6e',
        },
      },
    },
  },
  plugins: [],
};
