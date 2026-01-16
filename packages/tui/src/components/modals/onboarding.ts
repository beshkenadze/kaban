import {
  BoxRenderable,
  type CliRenderer,
  InputRenderable,
  InputRenderableEvents,
  TextRenderable,
} from "@opentui/core";
import { createButtonRow } from "../../lib/button-row.js";
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
      width: 52,
      height: 13,
      flexDirection: "column",
      border: true,
      borderStyle: "rounded",
      borderColor: COLORS.accent,
      backgroundColor: COLORS.panel,
      paddingTop: 1,
      paddingBottom: 1,
      paddingLeft: 2,
      paddingRight: 2,
    });

    const titleRow = new BoxRenderable(renderer, {
      id: "title-row",
      width: "100%",
      height: 1,
    });
    const title = new TextRenderable(renderer, {
      id: "title",
      content: "Welcome to Kaban",
      fg: COLORS.accent,
    });
    titleRow.add(title);

    const subtitleRow = new BoxRenderable(renderer, {
      id: "subtitle-row",
      width: "100%",
      height: 1,
    });
    const subtitle = new TextRenderable(renderer, {
      id: "subtitle",
      content: "No board found. Let's create one!",
      fg: COLORS.textMuted,
    });
    subtitleRow.add(subtitle);

    const spacer1 = new BoxRenderable(renderer, { id: "spacer1", width: "100%", height: 1 });

    const labelRow = new BoxRenderable(renderer, {
      id: "label-row",
      width: "100%",
      height: 1,
    });
    const label = new TextRenderable(renderer, {
      id: "label",
      content: "Board name:",
      fg: COLORS.text,
    });
    labelRow.add(label);

    const input = new InputRenderable(renderer, {
      id: "board-name-input",
      width: 44,
      height: 1,
      placeholder: "My Project Board",
      textColor: COLORS.text,
      placeholderColor: COLORS.textDim,
      backgroundColor: COLORS.inputBg,
      focusedBackgroundColor: COLORS.inputBg,
      cursorColor: COLORS.cursor,
    });

    const spacer2 = new BoxRenderable(renderer, { id: "spacer2", width: "100%", height: 1 });

    const doCreate = () => {
      renderer.keyInput.off("keypress", keyHandler);
      const boardName = input.value.trim() || "Kaban Board";
      container.destroy();
      resolvePromise(boardName);
    };

    const doQuit = () => {
      renderer.keyInput.off("keypress", keyHandler);
      renderer.destroy();
      process.exit(0);
    };

    const buttonRow = createButtonRow(renderer, "onboarding", [
      { label: "Create", action: doCreate, color: COLORS.success },
      { label: "Quit", action: doQuit, color: COLORS.danger },
    ]);

    card.add(titleRow);
    card.add(subtitleRow);
    card.add(spacer1);
    card.add(labelRow);
    card.add(input);
    card.add(spacer2);
    card.add(buttonRow.container);
    container.add(card);
    renderer.root.add(container);

    input.focus();
    input.on(InputRenderableEvents.ENTER, doCreate);

    const keyBindings: Record<string, () => void> = {
      tab: () => {
        input.blur();
        buttonRow.render();
      },
      down: () => {
        input.blur();
        buttonRow.render();
      },
      left: () => buttonRow.selectPrev(),
      right: () => buttonRow.selectNext(),
      return: () => {
        if (!input.focused) buttonRow.triggerSelected();
      },
      escape: doQuit,
    };

    const keyHandler = (key: { name: string }) => {
      keyBindings[key.name]?.();
    };

    renderer.keyInput.on("keypress", keyHandler);
  });
}
