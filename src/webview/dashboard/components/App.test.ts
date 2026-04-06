// @vitest-environment jsdom

import { h, render } from "preact";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";

const aiToolMock = vi.hoisted(() => ({
  isVisible: vi.fn(() => false),
  show: vi.fn(),
  hide: vi.fn(),
}));

vi.mock("../../ai-tool-selector", () => aiToolMock);

describe("dashboard App", () => {
  afterEach(() => {
    render(null, document.body);
    document.body.innerHTML = "";
    vi.clearAllMocks();
    aiToolMock.isVisible.mockReturnValue(false);
  });

  it("forwards the dashboard AI button action through onAction with session name", () => {
    const onAction = vi.fn();

    render(
      h(App, {
        payload: {
          sessions: [
            {
              id: "repo-a",
              name: "Repo A",
              workspace: "repo-a",
              isActive: true,
              preview: "",
            },
          ],
          workspace: "repo-a",
        },
        onAction,
      }),
      document.body,
    );

    const button = document.querySelector(
      '[data-action="showAiToolSelector"]',
    );

    expect(button).toBeInstanceOf(HTMLButtonElement);

    button?.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );

    expect(onAction).toHaveBeenCalledWith({
      action: "showAiToolSelector",
      sessionId: "repo-a",
      sessionName: "Repo A",
    });
    expect(aiToolMock.show).not.toHaveBeenCalled();
  });

  it("renders resolved pane tool badges for node-based panes", () => {
    render(
      h(App, {
        payload: {
          sessions: [
            {
              id: "repo-a",
              name: "Repo A",
              workspace: "repo-a",
              isActive: true,
              preview: "",
            },
          ],
          windows: {
            "repo-a": [
              {
                windowId: "@1",
                index: 0,
                name: "main",
                isActive: true,
                panes: [
                  {
                    paneId: "%1",
                    index: 0,
                    title: "shell",
                    isActive: true,
                    currentCommand: "node",
                    resolvedTool: "opencode",
                  },
                  {
                    paneId: "%2",
                    index: 1,
                    title: "shell",
                    isActive: false,
                    currentCommand: "node",
                    resolvedTool: "codex",
                  },
                ],
              },
            ],
          },
          tools: [
            {
              name: "opencode",
              label: "OpenCode",
              path: "",
              args: ["-c"],
              operator: "opencode",
            },
            {
              name: "codex",
              label: "Codex",
              path: "",
              args: [],
              operator: "codex",
            },
          ],
          workspace: "repo-a",
        },
        onAction: vi.fn(),
      }),
      document.body,
    );

    const badges = Array.from(document.querySelectorAll(".pane-tool-badge"));
    expect(badges).toHaveLength(2);
    expect(badges.map((badge) => badge.textContent)).toEqual(["OC", "CX"]);
  });
});
