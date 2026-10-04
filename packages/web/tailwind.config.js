/** @type {import('tailwindcss').Config} */

// The "rules world" of the promo film: black void, one emerald line, the cream of old type.
// The scales below are remapped for that dark ground, so components keep their semantic
// classes (slate-900 = strongest text, emerald-50 = quiet positive surface, …) unchanged.
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        void: "#04070D",
        navy: "#0F172A",
        panel: "#080D16",
        cream: "#EFE6D2",
        line: { core: "#D1FAE5", DEFAULT: "#34D399", glow: "#10B981", mono: "#6EE7B7" },
        slate: {
          50: "#0B121D", // inset surface
          100: "#111A27", // hairline / track
          200: "#18242F", // card border
          300: "#25343F", // input border
          400: "#5B6B80",
          500: "#8593A7", // muted text
          600: "#A3AFC0",
          700: "#CBD5E1", // body text
          800: "#E2E8F0",
          900: "#FFFFFF", // headings, strongest text
        },
        emerald: {
          50: "#07191A",
          100: "#0A2421",
          200: "#12392F",
          300: "#1C5A45",
          400: "#34D399",
          500: "#34D399",
          600: "#34D399",
          700: "#6EE7B7",
          800: "#A7F3D0",
          900: "#D1FAE5",
        },
        amber: {
          // warnings and late states: cream of the film's type, never gold
          50: "#14130F",
          100: "#1C1A15",
          200: "#3A362C",
          300: "#57503F",
          400: "#EFE6D2", // own savings: cream, like the borrower's band in the film
          500: "#EFE6D2",
          600: "#F6F1E5",
          700: "#FFFFFF",
          800: "#FFFFFF",
          900: "#FFFFFF",
        },
        rose: {
          50: "#1C0B11",
          100: "#2A1018",
          200: "#4A1A26",
          300: "#6B2335",
          600: "#FB7185",
          700: "#FDA4AF",
          800: "#FECDD3",
        },
        sky: {
          50: "#08151F",
          200: "#173647",
          500: "#10B981", // guarantors' bands: shades of the line
          700: "#9FC4DD",
        },
        indigo: { 500: "#6EE7B7" },
        violet: { 500: "#A7F3D0" },
        brand: {
          50: "#07191A",
          100: "#0A2421",
          500: "#34D399",
          600: "#10B981",
          700: "#6EE7B7",
        },
        solana: {
          purple: "#7c3aed",
          green: "#10b981",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      boxShadow: {
        sm: "inset 0 1px 0 0 rgba(209,250,229,0.03), 0 8px 24px -12px rgba(0,0,0,0.6)",
        lg: "0 0 0 1px rgba(52,211,153,0.12), 0 24px 48px -16px rgba(0,0,0,0.8)",
        glow: "0 0 0 1px rgba(52,211,153,0.35), 0 0 18px -2px rgba(16,185,129,0.55)",
      },
    },
  },
  plugins: [],
};
