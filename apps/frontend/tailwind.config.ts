import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        background: "#020617",
        foreground: "#e2e8f0"
      },
      backgroundImage: {
        "hero-gradient": "radial-gradient(circle at top, rgba(56, 189, 248, 0.22), rgba(15, 23, 42, 1) 40%)"
      },
      boxShadow: {
        glass: "0 8px 32px rgba(15, 23, 42, 0.45)"
      }
    }
  },
  plugins: []
};

export default config;
