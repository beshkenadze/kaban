export const COLORS = {
  bg: "#0d1117",
  panel: "#161b22",
  border: "#30363d",
  borderActive: "#58a6ff",
  text: "#e6edf3",
  textMuted: "#8b949e",
  textDim: "#6e7681",
  accent: "#58a6ff",
  accentBright: "#79c0ff",
  danger: "#f85149",
  success: "#3fb950",
  warning: "#d29922",
  overlay: "#00000088",
  inputBg: "#21262d",
  cursor: "#79c0ff",
} as const;

export type Theme = typeof COLORS;
