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
        brand: {
          50: "#e6f4ff",
          100: "#cde8ff",
          200: "#9fd0ff",
          300: "#6fb7ff",
          400: "#3f9eff",
          500: "#1f86e6",
          600: "#1568b4",
          700: "#0f4a82",
          800: "#093151",
          900: "#041621",
        },
      },
    },
  },
  plugins: [],
};

export default config;

