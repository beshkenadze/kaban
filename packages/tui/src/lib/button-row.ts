import { BoxRenderable, type CliRenderer, TextRenderable } from "@opentui/core";
import { COLORS } from "./theme.js";

export interface ButtonConfig {
  label: string;
  action: () => void | Promise<void>;
  color?: string;
}

export interface ButtonRowState {
  container: BoxRenderable;
  selectedIndex: number;
  buttons: ButtonConfig[];
  selectNext: () => void;
  selectPrev: () => void;
  triggerSelected: () => void | Promise<void>;
  render: () => void;
}

export function createButtonRow(
  renderer: CliRenderer,
  id: string,
  buttons: ButtonConfig[],
): ButtonRowState {
  const container = new BoxRenderable(renderer, {
    id: `${id}-button-row`,
    width: "100%",
    height: 1,
    flexDirection: "row",
    justifyContent: "center",
    gap: 2,
  });

  let selectedIndex = 0;
  const buttonTexts: TextRenderable[] = [];

  for (let i = 0; i < buttons.length; i++) {
    const btn = buttons[i];
    const isSelected = i === selectedIndex;
    const text = new TextRenderable(renderer, {
      id: `${id}-btn-${i}`,
      content: isSelected ? `[${btn.label}]` : ` ${btn.label} `,
      fg: isSelected ? (btn.color ?? COLORS.accentBright) : COLORS.textMuted,
      bg: isSelected ? COLORS.inputBg : undefined,
    });
    buttonTexts.push(text);
    container.add(text);
  }

  const render = () => {
    for (let i = 0; i < buttons.length; i++) {
      const btn = buttons[i];
      const isSelected = i === selectedIndex;
      buttonTexts[i].content = isSelected ? `[${btn.label}]` : ` ${btn.label} `;
      buttonTexts[i].fg = isSelected ? (btn.color ?? COLORS.accentBright) : COLORS.textMuted;
      buttonTexts[i].bg = isSelected ? COLORS.inputBg : undefined;
    }
  };

  const selectNext = () => {
    selectedIndex = (selectedIndex + 1) % buttons.length;
    render();
  };

  const selectPrev = () => {
    selectedIndex = (selectedIndex - 1 + buttons.length) % buttons.length;
    render();
  };

  const triggerSelected = () => {
    return buttons[selectedIndex].action();
  };

  return {
    container,
    selectedIndex,
    buttons,
    selectNext,
    selectPrev,
    triggerSelected,
    render,
  };
}
