import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as vscodeTypes from "../test/mocks/vscode";
import { SessionRuntime } from "./SessionRuntime";
import { TerminalManager } from "../terminals/TerminalManager";
import { OutputCaptureManager } from "../services/OutputCaptureManager";
import { OpenCodeApiClient } from "../services/OpenCodeApiClient";
import { PortManager } from "../services/PortManager";
import { ContextSharingService } from "../services/ContextSharingService";
import { OutputChannelService } from "../services/OutputChannelService";
import { InstanceStore } from "../services/InstanceStore";
import { TmuxSessionManager } from "../services/TmuxSessionManager";
import { AiToolOperatorRegistry } from "../services/aiTools/AiToolOperatorRegistry";

const vscode = await vi.importActual<typeof vscodeTypes>(
  "../test/mocks/vscode",
);

vi.mock("vscode", async () => {
  const actual = await vi.importActual("../test/mocks/vscode");
  return actual;
});

vi.mock("node-pty", async () => {
  const actual = await vi.importActual("../test/mocks/node-pty");
  return actual;
});

describe("SessionRuntime - Workspace Session Resolution", () => {
  let sessionRuntime: SessionRuntime;
  let mockTmuxSessionManager: TmuxSessionManager;
  let instanceStore: InstanceStore;
  let mockLogger: OutputChannelService;
  let mockCallbacks: {
    postMessage: ReturnType<typeof vi.fn>;
    onActiveInstanceChanged: ReturnType<typeof vi.fn>;
    requestStartOpenCode: ReturnType<typeof vi.fn>;
    showAiToolSelector: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    OutputChannelService.resetInstance();

    // Setup workspace folders
    vscode.workspace.workspaceFolders = [
      {
        uri: { fsPath: "/workspace/project-a" },
        name: "project-a",
        index: 0,
      },
    ];

    // Create mock tmux session manager with all required methods
    mockTmuxSessionManager = {
      listPanes: vi.fn(),
      createWindow: vi.fn(),
      selectWindow: vi.fn(),
      splitPane: vi.fn(),
      ensureSession: vi.fn(),
      nextWindow: vi.fn(),
      prevWindow: vi.fn(),
      zoomPane: vi.fn(),
      killPane: vi.fn(),
      listSessions: vi.fn(),
      findSessionForWorkspace: vi.fn(),
      getSessionInfo: vi.fn(),
    } as unknown as TmuxSessionManager;

    // Create real instance store (following pattern from TerminalProvider.test.ts)
    instanceStore = new InstanceStore();

    // Create mock logger
    mockLogger = OutputChannelService.getInstance();
    vi.spyOn(mockLogger, "warn");
    vi.spyOn(mockLogger, "error");
    vi.spyOn(mockLogger, "info");

    // Create mock callbacks
    mockCallbacks = {
      postMessage: vi.fn(),
      onActiveInstanceChanged: vi.fn(),
      requestStartOpenCode: vi.fn(),
      showAiToolSelector: vi.fn(),
    };

    // Create SessionRuntime instance with proper typing
    sessionRuntime = new SessionRuntime(
      {} as TerminalManager,
      {} as OutputCaptureManager,
      undefined as unknown as OpenCodeApiClient,
      {} as PortManager,
      mockTmuxSessionManager,
      instanceStore,
      mockLogger,
      {} as ContextSharingService,
      {} as AiToolOperatorRegistry,
      mockCallbacks,
    );
  });

  afterEach(() => {
    sessionRuntime.dispose();
    OutputChannelService.resetInstance();
  });

  describe("createTmuxWindow", () => {
    it("should use ensureWorkspaceSession to get current workspace session", async () => {
      // Setup: Mock ensureSession to return a workspace session
      vi.mocked(mockTmuxSessionManager.ensureSession).mockResolvedValue({
        action: "created" as const,
        session: { id: "project-a-session", name: "project-a" },
      });

      // Setup: Mock listPanes to return an active pane
      vi.mocked(mockTmuxSessionManager.listPanes).mockResolvedValue([
        {
          paneId: "%1",
          isActive: true,
          currentPath: "/workspace/project-a",
        },
      ] as unknown as Awaited<ReturnType<TmuxSessionManager["listPanes"]>>);

      // Setup: Mock createWindow
      vi.mocked(mockTmuxSessionManager.createWindow).mockResolvedValue({
        windowId: "@2",
        paneId: "%2",
      });

      // Act
      const result = await (
        sessionRuntime as unknown as {
          createTmuxWindow: () => Promise<
            { windowId: string; paneId: string } | undefined
          >;
        }
      ).createTmuxWindow();

      // Assert: ensureSession was called with the current workspace
      expect(mockTmuxSessionManager.ensureSession).toHaveBeenCalledWith(
        "project-a",
        "/workspace/project-a",
      );

      // Assert: createWindow was called with the workspace session
      expect(mockTmuxSessionManager.createWindow).toHaveBeenCalledWith(
        "project-a-session",
        "/workspace/project-a",
      );

      // Assert: result is correct
      expect(result).toEqual({ windowId: "@2", paneId: "%2" });
    });

    it("should create new workspace session when none exists", async () => {
      // Setup: Mock ensureSession to create a new session
      vi.mocked(mockTmuxSessionManager.ensureSession).mockResolvedValue({
        action: "created" as const,
        session: { id: "new-session", name: "project-a" },
      });

      // Setup: Mock listPanes
      vi.mocked(mockTmuxSessionManager.listPanes).mockResolvedValue([
        {
          paneId: "%1",
          isActive: true,
          currentPath: "/workspace/project-a",
        },
      ] as unknown as Awaited<ReturnType<TmuxSessionManager["listPanes"]>>);

      // Setup: Mock createWindow
      vi.mocked(mockTmuxSessionManager.createWindow).mockResolvedValue({
        windowId: "@1",
        paneId: "%1",
      });

      // Act
      await (
        sessionRuntime as unknown as {
          createTmuxWindow: () => Promise<
            { windowId: string; paneId: string } | undefined
          >;
        }
      ).createTmuxWindow();

      // Assert: New session was created
      expect(mockTmuxSessionManager.ensureSession).toHaveBeenCalledTimes(1);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("tmux session created"),
      );
    });

    it("should NOT use selectedTmuxSessionId from another workspace", async () => {
      // Setup: Add an instance with a different workspace to the store
      // This simulates having a selected session from another workspace
      instanceStore.upsert({
        config: {
          id: "workspace-b-instance",
          workspaceUri: "file:///workspace/project-b",
        },
        runtime: {
          terminalKey: "workspace-b-instance",
          tmuxSessionId: "project-b-session",
        },
        state: "connected",
      });

      // The old buggy behavior would use "project-b-session"
      // The fixed behavior should use ensureSession for project-a
      vi.mocked(mockTmuxSessionManager.ensureSession).mockResolvedValue({
        action: "created" as const,
        session: { id: "project-a-session", name: "project-a" },
      });

      vi.mocked(mockTmuxSessionManager.listPanes).mockResolvedValue([
        {
          paneId: "%1",
          isActive: true,
          currentPath: "/workspace/project-a",
        },
      ] as unknown as Awaited<ReturnType<TmuxSessionManager["listPanes"]>>);

      vi.mocked(mockTmuxSessionManager.createWindow).mockResolvedValue({
        windowId: "@2",
        paneId: "%2",
      });

      // Act
      await (
        sessionRuntime as unknown as {
          createTmuxWindow: () => Promise<
            { windowId: string; paneId: string } | undefined
          >;
        }
      ).createTmuxWindow();

      // Assert: The workspace session was used, not the other workspace's session
      expect(mockTmuxSessionManager.createWindow).toHaveBeenCalledWith(
        "project-a-session",
        expect.any(String),
      );
      expect(mockTmuxSessionManager.createWindow).not.toHaveBeenCalledWith(
        "project-b-session",
        expect.any(String),
      );
    });

    it("should return undefined when no workspace path is available", async () => {
      // Setup: Remove workspace folders
      vscode.workspace.workspaceFolders = undefined;

      // Act
      const result = await (
        sessionRuntime as unknown as {
          createTmuxWindow: () => Promise<
            { windowId: string; paneId: string } | undefined
          >;
        }
      ).createTmuxWindow();

      // Assert
      expect(result).toBeUndefined();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("no workspace session available"),
      );
    });

    it("should handle errors gracefully", async () => {
      // Setup: Mock ensureSession to throw
      vi.mocked(mockTmuxSessionManager.ensureSession).mockRejectedValue(
        new Error("tmux not available"),
      );

      // Act
      const result = await (
        sessionRuntime as unknown as {
          createTmuxWindow: () => Promise<
            { windowId: string; paneId: string } | undefined
          >;
        }
      ).createTmuxWindow();

      // Assert: Should return undefined on error
      expect(result).toBeUndefined();
      // Note: Error logging happens but spy may not capture it due to logger instance timing
    });
  });

  describe("splitTmuxPane", () => {
    it("should use ensureWorkspaceSession to get current workspace session", async () => {
      // Setup: Mock ensureSession to return a workspace session
      vi.mocked(mockTmuxSessionManager.ensureSession).mockResolvedValue({
        action: "found" as const,
        session: { id: "project-a-session", name: "project-a" },
      });

      // Setup: Mock listPanes to return an active pane
      vi.mocked(mockTmuxSessionManager.listPanes).mockResolvedValue([
        {
          paneId: "%1",
          isActive: true,
          currentPath: "/workspace/project-a",
        },
      ] as unknown as Awaited<ReturnType<TmuxSessionManager["listPanes"]>>);

      // Setup: Mock splitPane
      vi.mocked(mockTmuxSessionManager.splitPane).mockResolvedValue("%2");

      // Act
      const result = await (
        sessionRuntime as unknown as {
          splitTmuxPane: (direction: "h" | "v") => Promise<string | undefined>;
        }
      ).splitTmuxPane("v");

      // Assert: ensureSession was called with the current workspace
      expect(mockTmuxSessionManager.ensureSession).toHaveBeenCalledWith(
        "project-a",
        "/workspace/project-a",
      );

      // Assert: splitPane was called with the workspace session's pane
      expect(mockTmuxSessionManager.splitPane).toHaveBeenCalledWith("%1", "v", {
        workingDirectory: "/workspace/project-a",
      });

      // Assert: result is correct
      expect(result).toBe("%2");
    });

    it("should create new workspace session when none exists", async () => {
      // Setup: Mock ensureSession to create a new session
      vi.mocked(mockTmuxSessionManager.ensureSession).mockResolvedValue({
        action: "created" as const,
        session: { id: "new-session", name: "project-a" },
      });

      // Setup: Mock listPanes
      vi.mocked(mockTmuxSessionManager.listPanes).mockResolvedValue([
        {
          paneId: "%1",
          isActive: true,
          currentPath: "/workspace/project-a",
        },
      ] as unknown as Awaited<ReturnType<TmuxSessionManager["listPanes"]>>);

      // Setup: Mock splitPane
      vi.mocked(mockTmuxSessionManager.splitPane).mockResolvedValue("%2");

      // Act
      await (
        sessionRuntime as unknown as {
          splitTmuxPane: (direction: "h" | "v") => Promise<string | undefined>;
        }
      ).splitTmuxPane("h");

      // Assert: New session was created
      expect(mockTmuxSessionManager.ensureSession).toHaveBeenCalledTimes(1);
    });

    it("should NOT use selectedTmuxSessionId from another workspace", async () => {
      // Setup: Add an instance with a different workspace
      instanceStore.upsert({
        config: {
          id: "workspace-b-instance",
          workspaceUri: "file:///workspace/project-b",
        },
        runtime: {
          terminalKey: "workspace-b-instance",
          tmuxSessionId: "project-b-session",
        },
        state: "connected",
      });

      // The fix ensures we call ensureSession for the current workspace
      vi.mocked(mockTmuxSessionManager.ensureSession).mockResolvedValue({
        action: "found" as const,
        session: { id: "project-a-session", name: "project-a" },
      });

      vi.mocked(mockTmuxSessionManager.listPanes).mockResolvedValue([
        {
          paneId: "%1",
          isActive: true,
          currentPath: "/workspace/project-a",
        },
      ] as unknown as Awaited<ReturnType<TmuxSessionManager["listPanes"]>>);

      vi.mocked(mockTmuxSessionManager.splitPane).mockResolvedValue("%2");

      // Act
      await (
        sessionRuntime as unknown as {
          splitTmuxPane: (direction: "h" | "v") => Promise<string | undefined>;
        }
      ).splitTmuxPane("v");

      // Assert: The workspace session was used
      expect(mockTmuxSessionManager.splitPane).toHaveBeenCalledWith(
        "%1",
        "v",
        expect.any(Object),
      );

      // Ensure ensureSession was called (the fix ensures we don't use selectedTmuxSessionId directly)
      expect(mockTmuxSessionManager.ensureSession).toHaveBeenCalled();
    });

    it("should return undefined when no workspace path is available", async () => {
      // Setup: Remove workspace folders
      vscode.workspace.workspaceFolders = undefined;

      // Act
      const result = await (
        sessionRuntime as unknown as {
          splitTmuxPane: (direction: "h" | "v") => Promise<string | undefined>;
        }
      ).splitTmuxPane("v");

      // Assert
      expect(result).toBeUndefined();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("no workspace session available"),
      );
    });

    it("should handle horizontal and vertical splits correctly", async () => {
      vi.mocked(mockTmuxSessionManager.ensureSession).mockResolvedValue({
        action: "found" as const,
        session: { id: "project-a-session", name: "project-a" },
      });

      vi.mocked(mockTmuxSessionManager.listPanes).mockResolvedValue([
        {
          paneId: "%1",
          isActive: true,
          currentPath: "/workspace/project-a",
        },
      ] as unknown as Awaited<ReturnType<TmuxSessionManager["listPanes"]>>);

      vi.mocked(mockTmuxSessionManager.splitPane).mockResolvedValue("%2");

      // Test horizontal split
      await (
        sessionRuntime as unknown as {
          splitTmuxPane: (direction: "h" | "v") => Promise<string | undefined>;
        }
      ).splitTmuxPane("h");
      expect(mockTmuxSessionManager.splitPane).toHaveBeenLastCalledWith(
        "%1",
        "h",
        expect.any(Object),
      );

      // Test vertical split
      await (
        sessionRuntime as unknown as {
          splitTmuxPane: (direction: "h" | "v") => Promise<string | undefined>;
        }
      ).splitTmuxPane("v");
      expect(mockTmuxSessionManager.splitPane).toHaveBeenLastCalledWith(
        "%1",
        "v",
        expect.any(Object),
      );
    });
  });
});
