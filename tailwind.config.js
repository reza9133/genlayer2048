/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        body: ["'Inter'", "sans-serif"],
      },
      colors: {
        ink: {
          DEFAULT: "#0F0E14",
          50: "#F5F1E8",
          900: "#0F0E14",
        },
        surface: {
          DEFAULT: "#1C1926",
          raised: "#262233",
          border: "#332E42",
        },
        gold: {
          DEFAULT: "#EDC22E",
          soft: "#F2B179",
          deep: "#F65E3B",
        },
        chain: {
          DEFAULT: "#7C6FE8",
          soft: "#9C90F5",
          dim: "#4A4266",
        },
        muted: "#A79E8C",
      },
      boxShadow: {
        tile: "0 2px 0 rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.08)",
        glow: "0 0 0 1px rgba(124,111,232,0.4), 0 0 24px rgba(124,111,232,0.25)",
      },
      keyframes: {
        pop: {
          "0%": { transform: "scale(0.4)", opacity: "0" },
          "60%": { transform: "scale(1.08)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 rgba(124,111,232,0.55)" },
          "100%": { boxShadow: "0 0 0 18px rgba(124,111,232,0)" },
        },
      },
      animation: {
        pop: "pop 160ms ease-out",
        "pulse-ring": "pulse-ring 900ms ease-out",
      },
    },
  },
  plugins: [],
};
