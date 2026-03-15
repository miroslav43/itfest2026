import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          0: "#0a0a0f",
          50: "#0f1117",
          100: "#151720",
          200: "#1c1f2e",
          300: "#252838",
          400: "#2e3247",
        },
        accent: {
          DEFAULT: "#6366f1",
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
        },
        success: {
          DEFAULT: "#22c55e",
          50: "#0d2818",
          400: "#4ade80",
          500: "#22c55e",
        },
        danger: {
          DEFAULT: "#ef4444",
          50: "#2a0f0f",
          400: "#f87171",
          500: "#ef4444",
        },
        warning: {
          DEFAULT: "#f59e0b",
          50: "#271d08",
          400: "#fbbf24",
          500: "#f59e0b",
        },
        muted: {
          DEFAULT: "#64748b",
          foreground: "#94a3b8",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.25rem",
        "4xl": "1.5rem",
      },
      boxShadow: {
        glow: "0 0 20px -5px rgba(99, 102, 241, 0.3)",
        "glow-lg": "0 0 40px -10px rgba(99, 102, 241, 0.4)",
        card: "0 1px 3px rgba(0,0,0,0.12), 0 0 0 1px rgba(255,255,255,0.04)",
        "card-hover": "0 4px 12px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.06)",
      },
      animation: {
        "pulse-slow": "pulse 3s ease-in-out infinite",
        "fade-in": "fadeIn 0.2s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
