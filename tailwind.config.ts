// tailwind.config.ts
import type { Config } from "tailwindcss";

/**
 * DocCy brand palette (teal replaces former clinical blue completely).
 * Logo gradient (#1599B0 → #12BFC2) is for brand mark only — keep UI flat.
 */
const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      colors: {
        // Doccy Teal scale — primary CTAs, accents, focus rings
        clinical: {
          50: "#F0FBFC",
          100: "#E6F8F9", // Teal 100
          200: "#B8EBEF",
          300: "#7DD9DF",
          400: "#3AC5CD",
          500: "#12B8C0", // Doccy Teal
          600: "#0FA7B4", // Teal 600
          700: "#0D8A94",
          800: "#0A6B72",
          900: "#074D52",
        },
        wellness: {
          50: "#E6F5F3",
          100: "#C2E8E3",
          200: "#9AD9D1",
          300: "#6DC4B9",
          400: "#45B0A3",
          500: "#2A9D8F",
          600: "#228276",
          700: "#1A675E",
          800: "#134C46",
          900: "#0C332F",
        },
        // Navy + neutral text/surfaces
        ink: {
          50: "#F7FAFC", // Background
          100: "#EEF4F8",
          200: "#DDE7ED", // Borders
          300: "#B0C0CE",
          400: "#8A9BB0",
          500: "#718096", // Muted text
          600: "#4A5F73",
          700: "#33485C",
          800: "#24364B", // Body text
          900: "#062F61", // Navy 900 — headings + dark app chrome
        },
      },
    },
  },
  plugins: [],
};

export default config;
