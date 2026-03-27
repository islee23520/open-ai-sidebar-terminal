import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as vscodeTypes from "../test/mocks/vscode";
import { TmuxSessionManager } from "../services/TmuxSessionManager";
import { TmuxSessionsDashboardProvider } from "./TmuxSessionsDashboardProvider";

const vscode = await vi.importActual<typeof vscodeTypes>(
  "../test/mocks/vscode",
);

vi.mock("vscode", async () => {
  const actual = await vi.importActual("../test/mocks/vscode");
  return actual;
});

describe("TmuxSessionsDashboardProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vscode.workspace.workspaceFolders = [
      {
        uri: {
          fsPath: "/workspaces/repo-a",
        },
      },
    ];
  });

  async function flushPromises(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
  }

  function createProvider(discoverSessions = vi.fn().mockResolvedValue([])) {
    const context = new vscode.ExtensionContext();
    const tmuxSessionManager = {
      discoverSessions,
    } as unknown as TmuxSessionManager;

    return {
      discoverSessions,
      provider: new TmuxSessionsDashboardProvider(
        context as never,
        tmuxSessionManager,
      ),
    };
  }

  function resolveProvider(provider: TmuxSessionsDashboardProvider) {
    const view = vscode.WebviewView();
    provider.resolveWebviewView(view as never, {} as never, {} as never);
    const messageHandler = vi.mocked(view.webview.onDidReceiveMessage).mock
      .calls[0]?.[0] as (message: unknown) => Promise<void>;

    return { view, messageHandler };
  }

  it("posts workspace-filtered tmux sessions to the dashboard webview", async () => {
    const { provider } = createProvider(
      vi.fn().mockResolvedValue([
        {
          id: "repo-a",
          name: "repo-a",
          workspace: "repo-a",
          isActive: true,
        },
        {
          id: "repo-b",
          name: "repo-b",
          workspace: "repo-b",
          isActive: false,
        },
      ]),
    );

    const { view } = resolveProvider(provider);
    await flushPromises();

    expect(view.webview.postMessage).toHaveBeenCalledWith({
      type: "updateTmuxSessions",
      workspace: "repo-a",
      sessions: [
        {
          id: "repo-a",
          name: "repo-a",
          workspace: "repo-a",
          isActive: true,
        },
      ],
    });
  });

  it("routes activate/create/native actions through commands and refreshes", async () => {
    const { provider, discoverSessions } = createProvider(
      vi.fn().mockResolvedValue([
        {
          id: "repo-a",
          name: "repo-a",
          workspace: "repo-a",
          isActive: false,
        },
      ]),
    );

    const { view, messageHandler } = resolveProvider(provider);
    await flushPromises();
    vi.mocked(view.webview.postMessage).mockClear();

    await messageHandler({ action: "activate", sessionId: "repo-a" });
    await messageHandler({ action: "create" });
    await messageHandler({ action: "switchNativeShell" });

    expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
      "opencodeTui.switchTmuxSession",
      "repo-a",
    );
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
      "opencodeTui.createTmuxSession",
    );
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
      "opencodeTui.switchNativeShell",
    );
    expect(discoverSessions).toHaveBeenCalledTimes(4);
    expect(view.webview.postMessage).toHaveBeenCalledWith({
      type: "updateTmuxSessions",
      workspace: "repo-a",
      sessions: [
        {
          id: "repo-a",
          name: "repo-a",
          workspace: "repo-a",
          isActive: false,
        },
      ],
    });
  });

  it("refreshes sessions when the refresh action is received", async () => {
    const { provider, discoverSessions } = createProvider();
    const { view, messageHandler } = resolveProvider(provider);
    await flushPromises();
    vi.mocked(view.webview.postMessage).mockClear();

    await messageHandler({ action: "refresh" });

    expect(discoverSessions).toHaveBeenCalledTimes(2);
    expect(view.webview.postMessage).toHaveBeenCalledTimes(1);
  });
});
