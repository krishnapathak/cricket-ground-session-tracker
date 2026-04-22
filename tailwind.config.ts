import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#080B12",
        panel: "#111622",
        panelAlt: "#1A2130",
        line: "#2A3348",
        glow: "#D6F672",
        aqua: "#56D4FF",
        amber: "#FFBA4A",
        coral: "#FF6A66",
      },
      boxShadow: {
        ring: "0 0 0 1px rgba(255,255,255,0.08)",
        glow: "0 16px 50px rgba(214, 246, 114, 0.12)",
      },
      fontFamily: {
        display: ["Oswald", "Arial Narrow", "sans-serif"],
        body: ["Inter", "Segoe UI", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
