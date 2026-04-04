import type { Terminal } from "@xterm/xterm";
import * as AiSelector from "../ai-tool-selector";
import {
  copySelectionToClipboard,
  handlePasteWithImageSupport,
} from "../clipboard";

export function createKeyboardHandler(
  terminal: Terminal,
  _options: {
    onCopy: (text: string) => void;
    onPaste: () => void;
  },
) {
  let justHandledCtrlC = false;
  let lastPasteTime = 0;

  const handler = (event: KeyboardEvent): boolean => {
    if (AiSelector.isVisible()) {
      event.preventDefault();
      event.stopPropagation();
      return false;
    }

    const isCtrlC =
      event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey &&
      (event.key === "c" || event.key === "C");

    if (isCtrlC) {
      const selection = terminal.getSelection();
      if (selection && selection.length > 0) {
        copySelectionToClipboard(selection);
        justHandledCtrlC = true;
        setTimeout(() => {
          justHandledCtrlC = false;
        }, 100);
        event.preventDefault();
        event.stopPropagation();
        return false;
      }
      return true;
    }

    if (event.ctrlKey && (event.key === "v" || event.key === "V")) {
      const now = Date.now();
      if (now - lastPasteTime < 500) {
        return false;
      }
      lastPasteTime = now;
      event.preventDefault();
      event.stopPropagation();
      handlePasteWithImageSupport();
      return false;
    }

    return true;
  };

  return {
    handler,
    get justHandledCtrlC() {
      return justHandledCtrlC;
    },
    setJustHandledCtrlC(value: boolean) {
      justHandledCtrlC = value;
    },
  };
}
