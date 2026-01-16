export const COLORS = {
  bg: "#0d1117",
  panel: "#161b22",
  border: "#30363d",
  borderActive: "#58a6ff",
  text: "#e6edf3",
  textMuted: "#8b949e",
  textDim: "#484f58",
  accent: "#58a6ff",
  danger: "#f85149",
  overlay: "#00000088",
} as const;

export type Theme = typeof COLORS;
