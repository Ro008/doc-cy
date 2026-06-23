// tailwind.config.ts
import type { Config } from "tailwindcss";

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
        clinical: {
          50: "#E8F4FA",
          100: "#C5E4F3",
          200: "#9FD0EA",
          300: "#6BB8DE",
          400: "#3A9FCE",
          500: "#0B7BB5",
          600: "#096694",
          700: "#075278",
          800: "#053D5C",
          900: "#032A40",
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
        ink: {
          50: "#F7FAFC",
          100: "#EEF4F8",
          200: "#D8E3EC",
          300: "#B0BEC9",
          400: "#8A9BB0",
          500: "#5C6F82",
          600: "#445566",
          700: "#334455",
          800: "#1A2B3C",
          900: "#0F1F2E",
        },
      },
    },
  },
  plugins: [],
};

export default config;
