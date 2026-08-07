import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        surface: {
          0: "#0B0F17",
          1: "#111725",
          2: "#171F30",
          3: "#1F293E",
        },
        line: "#2A3650",
        signal: {
          DEFAULT: "#57B8FF",
          dim: "#2C5B80",
        },
        ok: "#4ADE80",
        warn: "#FACC15",
        danger: "#F87171",
        muted: "#8B99B5",
      },
    },
  },
  plugins: [],
};
export default config;
