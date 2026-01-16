import { BoxRenderable, type CliRenderer } from "@opentui/core";
import { COLORS } from "../lib/theme.js";

export interface ModalOverlayOptions {
  id: string;
  width: number;
  height: number;
  borderColor?: string;
  padding?: number;
  justifyContent?: "flex-start" | "center" | "flex-end" | "space-between" | "space-around";
  alignItems?: "flex-start" | "center" | "flex-end" | "stretch";
}

export interface ModalOverlayResult {
  overlay: BoxRenderable;
  dialog: BoxRenderable;
}

export function createModalOverlay(
  renderer: CliRenderer,
  options: ModalOverlayOptions,
): ModalOverlayResult {
  const overlay = new BoxRenderable(renderer, {
    id: "modal-overlay",
    width: "100%",
    height: "100%",
    position: "absolute",
    top: 0,
    left: 0,
    backgroundColor: COLORS.overlay,
    justifyContent: "center",
    alignItems: "center",
  });

  const dialog = new BoxRenderable(renderer, {
    id: options.id,
    width: options.width,
    height: options.height,
    flexDirection: "column",
    border: true,
    borderStyle: "double",
    borderColor: options.borderColor ?? COLORS.accent,
    backgroundColor: COLORS.panel,
    padding: options.padding ?? 1,
    justifyContent: options.justifyContent,
    alignItems: options.alignItems,
  });

  overlay.add(dialog);

  return { overlay, dialog };
}
