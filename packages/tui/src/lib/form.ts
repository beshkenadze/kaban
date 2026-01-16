import { BoxRenderable, type CliRenderer, InputRenderable, TextRenderable } from "@opentui/core";
import { COLORS } from "./theme.js";

export interface FormCardOptions {
  id: string;
  title: string;
  subtitle?: string;
  width?: number;
  borderColor?: string;
}

export interface FormCard {
  container: BoxRenderable;
  card: BoxRenderable;
  content: BoxRenderable;
  addRow: (text: string, color?: string) => TextRenderable;
  addSpacer: (height?: number) => BoxRenderable;
  addInput: (options: { id: string; placeholder?: string; width?: number }) => InputRenderable;
  addHint: (text: string) => TextRenderable;
  mount: () => void;
  destroy: () => void;
}

export function createFormCard(renderer: CliRenderer, options: FormCardOptions): FormCard {
  const { id, title, subtitle, width = 52, borderColor = COLORS.accent } = options;

  const container = new BoxRenderable(renderer, {
    id: `${id}-container`,
    width: "100%",
    height: "100%",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.bg,
  });

  const card = new BoxRenderable(renderer, {
    id: `${id}-card`,
    width,
    flexDirection: "column",
    border: true,
    borderStyle: "rounded",
    borderColor,
    backgroundColor: COLORS.panel,
    paddingTop: 1,
    paddingBottom: 1,
    paddingLeft: 2,
    paddingRight: 2,
  });

  const content = new BoxRenderable(renderer, {
    id: `${id}-content`,
    width: "100%",
    flexDirection: "column",
    gap: 0,
  });

  const titleRow = new BoxRenderable(renderer, {
    id: `${id}-title-row`,
    width: "100%",
    height: 1,
  });
  const titleText = new TextRenderable(renderer, {
    id: `${id}-title`,
    content: title,
    fg: COLORS.accent,
  });
  titleRow.add(titleText);
  content.add(titleRow);

  if (subtitle) {
    const subtitleRow = new BoxRenderable(renderer, {
      id: `${id}-subtitle-row`,
      width: "100%",
      height: 1,
    });
    const subtitleText = new TextRenderable(renderer, {
      id: `${id}-subtitle`,
      content: subtitle,
      fg: COLORS.textMuted,
    });
    subtitleRow.add(subtitleText);
    content.add(subtitleRow);
  }

  let rowCount = 0;

  const addRow = (text: string, color: string = COLORS.text): TextRenderable => {
    const row = new BoxRenderable(renderer, {
      id: `${id}-row-${rowCount++}`,
      width: "100%",
      height: 1,
    });
    const textEl = new TextRenderable(renderer, {
      id: `${id}-text-${rowCount}`,
      content: text,
      fg: color,
    });
    row.add(textEl);
    content.add(row);
    return textEl;
  };

  const addSpacer = (height: number = 1): BoxRenderable => {
    const spacer = new BoxRenderable(renderer, {
      id: `${id}-spacer-${rowCount++}`,
      width: "100%",
      height,
    });
    content.add(spacer);
    return spacer;
  };

  const addInput = (inputOptions: {
    id: string;
    placeholder?: string;
    width?: number;
  }): InputRenderable => {
    const inputWidth = inputOptions.width ?? width - 6;
    const input = new InputRenderable(renderer, {
      id: inputOptions.id,
      width: inputWidth,
      height: 1,
      placeholder: inputOptions.placeholder ?? "",
      textColor: COLORS.text,
      placeholderColor: COLORS.textDim,
      backgroundColor: COLORS.inputBg,
      focusedBackgroundColor: COLORS.inputBg,
      cursorColor: COLORS.cursor,
    });
    content.add(input);
    return input;
  };

  const addHint = (text: string): TextRenderable => {
    const row = new BoxRenderable(renderer, {
      id: `${id}-hint-row`,
      width: "100%",
      height: 1,
    });
    const hintText = new TextRenderable(renderer, {
      id: `${id}-hint`,
      content: text,
      fg: COLORS.textDim,
    });
    row.add(hintText);
    content.add(row);
    return hintText;
  };

  card.add(content);
  container.add(card);

  const mount = () => {
    renderer.root.add(container);
  };

  const destroy = () => {
    container.destroy();
  };

  return {
    container,
    card,
    content,
    addRow,
    addSpacer,
    addInput,
    addHint,
    mount,
    destroy,
  };
}
