/** @type {import('tailwindcss').Config} */
// Brand tokens shared with the trailer: packages/promo/src/theme.ts ("rules world").
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        void: "#04070d",
        navy: "#0f172a",
        line: {
          core: "#d1fae5",
          DEFAULT: "#34d399",
          glow: "#10b981",
        },
        cream: "#efe6d2",
        mint: "#6ee7b7",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
        serif: ['"Bodoni Moda"', "Didot", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};
