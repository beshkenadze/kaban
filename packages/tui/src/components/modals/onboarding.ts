import {
  BoxRenderable,
  type CliRenderer,
  InputRenderable,
  InputRenderableEvents,
  TextRenderable,
} from "@opentui/core";
import { COLORS } from "../../lib/theme.js";

export async function showOnboarding(renderer: CliRenderer): Promise<string> {
  return new Promise((resolvePromise) => {
    const container = new BoxRenderable(renderer, {
      id: "onboarding",
      width: "100%",
      height: "100%",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: COLORS.bg,
    });

    const card = new BoxRenderable(renderer, {
      id: "card",
      width: 50,
      height: 12,
      flexDirection: "column",
      border: true,
      borderStyle: "double",
      borderColor: COLORS.accent,
      backgroundColor: COLORS.panel,
      padding: 2,
    });

    const title = new TextRenderable(renderer, {
      id: "title",
      content: "Welcome to Kaban",
      fg: COLORS.accent,
    });

    const subtitle = new TextRenderable(renderer, {
      id: "subtitle",
      content: "No board found. Let's create one!",
      fg: COLORS.textMuted,
    });

    const spacer1 = new BoxRenderable(renderer, { id: "spacer1", width: "100%", height: 1 });

    const label = new TextRenderable(renderer, {
      id: "label",
      content: "Board name:",
      fg: COLORS.text,
    });

    const input = new InputRenderable(renderer, {
      id: "board-name-input",
      width: 44,
      height: 1,
      placeholder: "My Project Board",
      textColor: COLORS.text,
      placeholderColor: COLORS.textDim,
      backgroundColor: COLORS.bg,
      focusedBackgroundColor: COLORS.bg,
      cursorColor: COLORS.accent,
    });

    const spacer2 = new BoxRenderable(renderer, { id: "spacer2", width: "100%", height: 1 });

    const hint = new TextRenderable(renderer, {
      id: "hint",
      content: "[Enter] Create  [Esc] Quit",
      fg: COLORS.textDim,
    });

    card.add(title);
    card.add(subtitle);
    card.add(spacer1);
    card.add(label);
    card.add(input);
    card.add(spacer2);
    card.add(hint);
    container.add(card);
    renderer.root.add(container);

    input.focus();

    input.on(InputRenderableEvents.ENTER, () => {
      const boardName = input.value.trim() || "Kaban Board";
      container.destroy();
      resolvePromise(boardName);
    });

    const keyHandler = (key: { name: string }) => {
      if (key.name === "escape") {
        renderer.keyInput.off("keypress", keyHandler);
        renderer.destroy();
        process.exit(0);
      }
    };
    renderer.keyInput.on("keypress", keyHandler);
  });
}
