/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],

  theme: {
    extend: {
      colors: {
        keiyian: {
          50: "#f5f8f3",
          100: "#ebf1e8",
          200: "#d9e5d5",
          300: "#b8ccb4",
          400: "#8daa8a",
          500: "#648362",
          600: "#4a6b4d",
          700: "#36553c",
          800: "#28432f",
          900: "#1e3527",
        },

        slate: {
          50: "#f6f8f5",
          100: "#eef2ed",
          200: "#e0e7df",
          300: "#cbd5ca",
          400: "#9ba79b",
          500: "#778477",
          600: "#5e6b5e",
          700: "#465246",
          800: "#303a31",
          900: "#1d2920",
        },

        primary: {
          50: "#f5f7ed",
          100: "#eaf0dc",
          200: "#dce6bf",
          300: "#c5d39b",
          400: "#a6b676",
          500: "#80924f",
          600: "#657a3b",
          700: "#506431",
          800: "#40532a",
          900: "#334522",
        },
      },
    },
  },

  plugins: [],
};