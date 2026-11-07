/** @type {import('tailwindcss').Config} */

// Keiyian ERP design tokens.
// - primary: forest green taken from the cooperative's seal (buttons, links, focus, active nav)
// - slate:   near-neutral grays with a faint green cast (text, borders, surfaces)
// - sidebar: the dark navigation surface
// Status colours use Tailwind's emerald / amber / rose / sky and are reserved for state.
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#eef8f1",
          100: "#d6efdd",
          200: "#ade0bd",
          300: "#7bc995",
          400: "#47ad6c",
          500: "#23914f",
          600: "#16753f",
          700: "#125f34",
          800: "#114c2c",
          900: "#0f3f26",
          950: "#062314",
        },
        slate: {
          50: "#f7f8f7",
          100: "#f0f2f1",
          200: "#e3e7e5",
          300: "#cdd3d0",
          400: "#9aa39f",
          500: "#6c7571",
          600: "#4f5854",
          700: "#3a423e",
          800: "#252b28",
          900: "#161b19",
          950: "#0d110f",
        },
        sidebar: {
          DEFAULT: "#0a2418",
          raised: "#10301f",
          border: "#1b3b2a",
          text: "#b9cbbf",
          muted: "#7d968a",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(13 17 15 / 0.04), 0 1px 3px 0 rgb(13 17 15 / 0.04)",
        raised: "0 4px 12px -2px rgb(13 17 15 / 0.08), 0 2px 4px -2px rgb(13 17 15 / 0.05)",
        overlay: "0 24px 48px -12px rgb(13 17 15 / 0.25)",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "pop-in": { from: { opacity: "0", transform: "translateY(8px) scale(0.98)" }, to: { opacity: "1", transform: "none" } },
        "slide-down": { from: { opacity: "0", transform: "translateY(-4px)" }, to: { opacity: "1", transform: "none" } },
        "toast-in": { from: { opacity: "0", transform: "translateY(12px)" }, to: { opacity: "1", transform: "none" } },
      },
      animation: {
        "fade-in": "fade-in 150ms ease-out",
        "pop-in": "pop-in 180ms cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-down": "slide-down 140ms ease-out",
        "toast-in": "toast-in 220ms cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};
