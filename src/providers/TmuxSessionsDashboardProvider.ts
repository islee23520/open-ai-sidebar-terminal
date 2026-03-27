import * as path from "path";
import * as vscode from "vscode";
import { TmuxSessionManager } from "../services/TmuxSessionManager";
import {
  TmuxDashboardActionMessage,
  TmuxDashboardHostMessage,
  TmuxDashboardSessionDto,
} from "../types";

export class TmuxSessionsDashboardProvider
  implements vscode.WebviewViewProvider, vscode.Disposable
{
  public static readonly viewType = "opencodeTui.tmuxSessions";

  private view?: vscode.WebviewView;
  private readonly subscriptions: vscode.Disposable[] = [];

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly tmuxSessionManager: TmuxSessionManager,
    private readonly outputChannel?: vscode.OutputChannel,
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri],
    };

    webviewView.webview.html = this.getHtmlContent(webviewView.webview);

    this.subscriptions.push(
      webviewView.webview.onDidReceiveMessage((message) => {
        void this.handleWebviewMessage(message as TmuxDashboardActionMessage);
      }),
    );

    this.subscriptions.push(
      webviewView.onDidChangeVisibility(() => {
        if (webviewView.visible) {
          void this.postSessionsToWebview();
        }
      }),
    );

    this.subscriptions.push(
      webviewView.onDidDispose(() => {
        if (this.view === webviewView) {
          this.view = undefined;
        }
      }),
    );

    void this.postSessionsToWebview();
  }

  private async postSessionsToWebview(): Promise<void> {
    if (!this.view) {
      return;
    }

    try {
      const sessions = await this.tmuxSessionManager.discoverSessions();
      const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      const workspaceName = workspacePath
        ? path.basename(workspacePath)
        : undefined;

      const filtered = workspaceName
        ? sessions.filter((session) => session.workspace === workspaceName)
        : sessions;

      const payload: TmuxDashboardSessionDto[] = filtered.map((session) => ({
        id: session.id,
        name: session.name,
        workspace: session.workspace,
        isActive: session.isActive,
      }));

      const message: TmuxDashboardHostMessage = {
        type: "updateTmuxSessions",
        sessions: payload,
        workspace: workspaceName ?? "No workspace",
      };

      await this.view.webview.postMessage(message);
    } catch (error) {
      this.outputChannel?.appendLine(
        `[TmuxSessionsDashboardProvider] Failed to load tmux sessions: ${error instanceof Error ? error.message : String(error)}`,
      );
      const message: TmuxDashboardHostMessage = {
        type: "updateTmuxSessions",
        sessions: [],
        workspace: "Unavailable",
      };

      await this.view.webview.postMessage(message);
    }
  }

  private async handleWebviewMessage(
    message: TmuxDashboardActionMessage | undefined,
  ): Promise<void> {
    if (!message) {
      return;
    }

    switch (message.action) {
      case "refresh":
        await this.postSessionsToWebview();
        return;
      case "activate":
        await vscode.commands.executeCommand(
          "opencodeTui.switchTmuxSession",
          message.sessionId,
        );
        await this.postSessionsToWebview();
        return;
      case "create":
        await vscode.commands.executeCommand("opencodeTui.createTmuxSession");
        await this.postSessionsToWebview();
        return;
      case "switchNativeShell":
        await vscode.commands.executeCommand("opencodeTui.switchNativeShell");
        await this.postSessionsToWebview();
        return;
      default:
        return;
    }
  }

  private getHtmlContent(webview: vscode.Webview): string {
    const nonce = this.getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tmux Sessions</title>
  <style>
    body {
      margin: 0;
      padding: 10px;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
      gap: 10px;
    }
    .header-main {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
      flex: 1;
    }
    .header-actions {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .workspace {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .title {
      font-size: 13px;
      font-weight: 600;
    }
    .session-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .session-card {
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      padding: 8px;
    }
    .session-card.active {
      border-color: var(--vscode-focusBorder);
      box-shadow: 0 0 0 1px var(--vscode-focusBorder);
    }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }
    .meta {
      margin-top: 4px;
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
    }
    .meta-grid {
      display: grid;
      gap: 2px;
      margin-top: 6px;
    }
    button {
      border: 1px solid var(--vscode-button-border, transparent);
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border-radius: 4px;
      padding: 4px 8px;
      cursor: pointer;
      font-size: 12px;
    }
    button.primary {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    button[disabled] {
      cursor: default;
      opacity: 0.7;
    }
    .status {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .empty {
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
      padding: 8px;
      border: 1px dashed var(--vscode-panel-border);
      border-radius: 6px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-main">
      <div class="title">Tmux Sessions</div>
      <div class="workspace" id="workspace">Workspace: -</div>
    </div>
    <div class="header-actions">
      <button id="create" class="primary" data-action="create">New tmux</button>
      <button id="native-shell" data-action="switchNativeShell">Native shell</button>
      <button id="refresh" data-action="refresh">Refresh</button>
    </div>
  </div>
  <div id="session-list" class="session-list"></div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    function escapeHtml(value) {
      return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
    }

    function render(payload) {
      const workspace = document.getElementById("workspace");
      const list = document.getElementById("session-list");
      if (!workspace || !list) {
        return;
      }

      workspace.textContent = "Workspace: " + (payload.workspace || "-");

      const sessions = Array.isArray(payload.sessions) ? payload.sessions : [];
      if (sessions.length === 0) {
        list.innerHTML = '<div class="empty">No tmux sessions for this workspace.</div>';
        return;
      }

      list.innerHTML = sessions
        .map((session) => {
          const activeClass = session.isActive ? " active" : "";
          const statusText = session.isActive ? "Current" : "Available";
          const buttonLabel = session.isActive ? "Current" : "Switch";
          const disabled = session.isActive ? ' disabled' : '';
          return [
            '<div class="session-card' + activeClass + '">',
            '<div class="row">',
            '<div>',
            '<strong>' + escapeHtml(session.name) + '</strong>',
            '<div class="status">' + statusText + '</div>',
            '</div>',
            '<button class="primary" data-session-id="' + escapeHtml(session.id) + '"' + disabled + '>' + buttonLabel + '</button>',
            '</div>',
            '<div class="meta-grid">',
            '<div class="meta">tmux session: ' + escapeHtml(session.id) + '</div>',
            '<div class="meta">workspace: ' + escapeHtml(session.workspace) + '</div>',
            '</div>',
            '</div>'
          ].join("");
        })
        .join("");
    }

    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLButtonElement)) {
        return;
      }

      const action = target.dataset.action;
      if (action === "refresh" || action === "create" || action === "switchNativeShell") {
        vscode.postMessage({ action });
        return;
      }

      const sessionId = target.dataset.sessionId;
      if (sessionId) {
        vscode.postMessage({ action: "activate", sessionId });
      }
    });

    window.addEventListener("message", (event) => {
      const message = event.data;
      if (message && message.type === "updateTmuxSessions") {
        render(message);
      }
    });

    vscode.postMessage({ action: "refresh" });
  </script>
</body>
</html>`;
  }

  private getNonce(): string {
    let text = "";
    const possible =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  public dispose(): void {
    for (const subscription of this.subscriptions) {
      subscription.dispose();
    }
    this.subscriptions.length = 0;
    this.view = undefined;
  }
}
