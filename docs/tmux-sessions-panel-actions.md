# Tmux Sessions panel actions

This note captures the intended UI for tmux session management after moving the control surface out of the terminal top strip.

## Goals

- Make the dedicated **Tmux Sessions** panel the single management surface for tmux session actions.
- Keep the terminal top area focused on active-session tabs only.
- Keep the terminal top area display-only; it should not create, kill, or switch sessions.
- Let users create, switch, and return to the native shell from the panel itself.

## Wireframe

```text
┌──────────────────────────────────────────────┐
│ Tmux Sessions                    [New tmux] │
│ Workspace: repo-name         [Native shell] │
│                                  [Refresh]  │
├──────────────────────────────────────────────┤
│ repo-name                                    │
│ Current                                      │
│ tmux session: repo-name                      │
│ workspace: repo-name                [Current]│
├──────────────────────────────────────────────┤
│ repo-name-2                                  │
│ Available                                    │
│ tmux session: repo-name-2                    │
│ workspace: repo-name                 [Switch]│
└──────────────────────────────────────────────┘
```

## Interaction model

- **New tmux** creates a workspace-scoped tmux session and switches the active terminal runtime to it.
- **Native shell** returns the active terminal runtime to the non-tmux shell.
- **Refresh** reloads the workspace-filtered session list.
- **Switch** changes the active runtime to the selected tmux session.

## Message flow

```text
TmuxSessionsDashboardProvider webview
  -> VS Code command bridge in ExtensionLifecycle
  -> OpenCodeTuiProvider runtime switch/create methods
```

## Non-goals

- Do not reintroduce `+ tmux`, `native`, switch, or kill controls in the terminal top strip.
- Do not move tmux creation/switch runtime logic into browser-side webview code.
