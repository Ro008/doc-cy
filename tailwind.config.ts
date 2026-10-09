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
      // Doctor dashboard motion; always paired with `motion-safe:` at call sites.
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        pop: {
          "0%": { transform: "scale(0.6)" },
          "60%": { transform: "scale(1.18)" },
          "100%": { transform: "scale(1)" },
        },
        "check-in": {
          "0%": { opacity: "0", transform: "scale(0.4) rotate(-20deg)" },
          "70%": { opacity: "1", transform: "scale(1.1) rotate(4deg)" },
          "100%": { opacity: "1", transform: "scale(1) rotate(0)" },
        },
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
        shimmer: {
          from: { backgroundPosition: "100% 0" },
          to: { backgroundPosition: "-100% 0" },
        },
        // Noticeable but calm, drawn inside the chip (agenda columns clip overflow).
        spotlight: {
          "0%, 100%": {
            boxShadow: "inset 0 0 0 2px rgba(255, 255, 255, 0.25), 0 0 0 0 rgba(125, 217, 223, 0)",
            filter: "brightness(1)",
          },
          "50%": {
            boxShadow: "inset 0 0 0 2px rgba(255, 255, 255, 0.85), 0 0 16px 2px rgba(125, 217, 223, 0.55)",
            filter: "brightness(1.15)",
          },
        },
      },
      animation: {
        "fade-up": "fade-up 420ms cubic-bezier(0.2, 0.7, 0.2, 1) both",
        pop: "pop 360ms cubic-bezier(0.2, 0.7, 0.2, 1)",
        "check-in": "check-in 520ms cubic-bezier(0.2, 0.7, 0.2, 1) both",
        blink: "blink 1.6s ease-in-out infinite",
        shimmer: "shimmer 1.4s linear infinite",
        spotlight: "spotlight 1.6s ease-in-out 1",
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
        // Public profile only (.doccy-profile in globals.css; values in lib/profile-theme.ts).
        // Switch between light and dark with the patient's device setting.
        profile: {
          bg: "var(--p-bg)",
          surface: "var(--p-surface)",
          border: "var(--p-border)",
          text: "var(--p-text)",
          body: "var(--p-body)",
          muted: "var(--p-muted)",
          off: "var(--p-off)",
        },
        // The professional's chosen accent on their public profile.
        accent: {
          DEFAULT: "var(--p-accent)",
          on: "var(--p-accent-on)",
          btn: "var(--p-accent-btn)",
          avatar: "var(--p-accent-avatar)",
          soft: "var(--p-accent-soft)",
          link: "var(--p-accent-link)",
          cta: "var(--p-accent-cta)",
          "on-cta": "var(--p-accent-on-cta)",
        },
      },
    },
  },
  plugins: [],
};

export default config;
