// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { createKeyboardHandler } from "./keyboard";

describe("createKeyboardHandler", () => {
  const createKeyboardEvent = (
    init: KeyboardEventInit & { code: string },
  ): KeyboardEvent => {
    const event = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      ...init,
    });

    Object.defineProperty(event, "code", {
      value: init.code,
    });

    return event;
  };

  it("suppresses browser default for Ctrl+letter chords but still allows xterm handling", () => {
    const keyboard = createKeyboardHandler();
    const event = createKeyboardEvent({
      ctrlKey: true,
      key: "x",
      code: "KeyX",
    });

    const allowed = keyboard.handler(event);

    expect(allowed).toBe(true);
    expect(event.defaultPrevented).toBe(true);
  });

  it("suppresses browser default for Cmd+letter chords", () => {
    const keyboard = createKeyboardHandler();
    const event = createKeyboardEvent({
      metaKey: true,
      key: "l",
      code: "KeyL",
    });

    const allowed = keyboard.handler(event);

    expect(allowed).toBe(true);
    expect(event.defaultPrevented).toBe(true);
  });

  it("does not intercept plain letter keys", () => {
    const keyboard = createKeyboardHandler();
    const event = createKeyboardEvent({
      key: "l",
      code: "KeyL",
    });

    const allowed = keyboard.handler(event);

    expect(allowed).toBe(true);
    expect(event.defaultPrevented).toBe(false);
  });

  it("does not intercept Alt-modified chords", () => {
    const keyboard = createKeyboardHandler();
    const event = createKeyboardEvent({
      ctrlKey: true,
      altKey: true,
      key: "m",
      code: "KeyM",
    });

    const allowed = keyboard.handler(event);

    expect(allowed).toBe(true);
    expect(event.defaultPrevented).toBe(false);
  });
});
