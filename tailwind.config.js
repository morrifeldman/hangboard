/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Teal-shifted stand-ins for gray-900 / gray-800 / gray-700, so the whole
        // workout screen reads as warm-up at a glance from the board.
        warmup: { base: "#0a2327", panel: "#10343a", edge: "#1b4a50" },
      },
    },
  },
  plugins: [],
};
