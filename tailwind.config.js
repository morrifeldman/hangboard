/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Archivo Variable", "system-ui", "sans-serif"],
      },
      colors: {
        // The one colour that means "tap here" or "you are here", on every screen.
        // Category colours (ARC orange, Cardio red, …) stay for labelling types only.
        accent: { 300: "#86efac", 400: "#4ade80", 500: "#22c55e", 600: "#16a34a", 700: "#15803d" },
        // Teal-shifted stand-ins for gray-900 / gray-800 / gray-700, so the whole
        // workout screen reads as warm-up at a glance from the board.
        warmup: { base: "#0a2327", panel: "#10343a", edge: "#1b4a50" },
      },
    },
  },
  plugins: [],
};
