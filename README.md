# OpenCode Sidebar TUI

[![Visual Studio Marketplace](https://img.shields.io/visual-studio-marketplace/v/islee23520.opencode-sidebar-tui?logo=visual-studio-code&label=VS%20Code%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=islee23520.opencode-sidebar-tui)
[![Open VSX](https://img.shields.io/open-vsx/v/islee23520/opencode-sidebar-tui?logo=open-vsx&label=Open%20VSX)](https://open-vsx.org/extension/islee23520/opencode-sidebar-tui)

Automatically render OpenCode TUI in VS Code: sidebar with full terminal support.

## Features

- **Auto-launch OpenCode**: Opens OpenCode automatically when the sidebar is activated
- **Full TUI Support**: Complete terminal emulation with xterm.js and WebGL rendering
- **HTTP API Integration**: Bidirectional communication with OpenCode CLI via HTTP API
- **Auto-Context Sharing**: Automatically shares editor context when terminal opens
- **File References with Line Numbers**: Send file references with `@filename#L10-L20` syntax
- **Keyboard Shortcuts**: Quick access with `Cmd+Alt+L` and `Cmd+Alt+A`
- **Drag & Drop Support**: Hold Shift and drag files/folders to send as references
- **Context Menu Integration**: Right-click files in Explorer or text in Editor to send to OpenCode
- **Configurable**: Customize command, font, terminal settings, and HTTP API behavior
- **Multi-CLI Support**: Run multiple AI tools in separate tabs (Claude, Codex, Gemini, Aider)

## Multi-CLI Support

The extension supports running multiple AI CLI tools simultaneously in separate tabs. This lets you compare responses from different AI assistants or use the best tool for specific tasks.

### Supported Tools

| Tool       | CLI Command | Description                         |
| ---------- | ----------- | ----------------------------------- |
| **Claude** | `claude`    | Anthropic's Claude AI assistant     |
| **Codex**  | `codex`     | OpenAI's Codex CLI for coding tasks |
| **Gemini** | `gemini`    | Google's Gemini CLI                 |
| **Aider**  | `aider`     | AI pair programming assistant       |

### Tab Management

Manage multiple CLI tabs directly from the sidebar:

- **Add New Tab** - Click the "+" button to create a new tab
- **Switch Tabs** - Click any tab to switch between active CLIs
- **Close Tab** - Click the "x" on a tab or use the context menu
- **Tab Persistence** - Tab configuration is preserved across VS Code: sessions

Each tab runs an independent terminal process with its own CLI configuration.

### Per-Tab Configuration

Each tab can be configured with different settings:

| Setting     | Description                                       |
| ----------- | ------------------------------------------------- |
| `command`   | The CLI command to run in this tab                |
| `name`      | Custom display name for the tab                   |
| `color`     | Tab color indicator for visual distinction        |
| `autoStart` | Whether to auto-start this CLI when the tab opens |

### Configuration Examples

#### Claude Configuration

```json
{
  "opencodeTui.tabs": [
    {
      "id": "claude",
      "name": "Claude",
      "command": "claude",
      "color": "#CC785C"
    }
  ]
}
```

#### Codex Configuration

```json
{
  "opencodeTui.tabs": [
    {
      "id": "codex",
      "name": "Codex",
      "command": "codex",
      "color": "#74AA9C"
    }
  ]
}
```

#### Gemini Configuration

```json
{
  "opencodeTui.tabs": [
    {
      "id": "gemini",
      "name": "Gemini",
      "command": "gemini",
      "color": "#4285F4"
    }
  ]
}
```

#### Aider Configuration

```json
{
  "opencodeTui.tabs": [
    {
      "id": "aider",
      "name": "Aider",
      "command": "aider",
      "color": "#FF6B6B"
    }
  ]
}
```

#### Multi-Tool Setup

Configure multiple tools in separate tabs:

```json
{
  "opencodeTui.tabs": [
    {
      "id": "opencode",
      "name": "OpenCode",
      "command": "opencode -c",
      "color": "#6366F1",
      "autoStart": true
    },
    {
      "id": "claude",
      "name": "Claude",
      "command": "claude",
      "color": "#CC785C",
      "autoStart": false
    },
    {
      "id": "codex",
      "name": "Codex",
      "command": "codex",
      "color": "#74AA9C",
      "autoStart": false
    }
  ]
}
```

### Keyboard Shortcuts for Tabs

| Shortcut                       | Action          | Description                |
| ------------------------------ | --------------- | -------------------------- |
| `Cmd+1-9` / `Ctrl+1-9`         | Switch to tab N | Jump directly to tab 1-9   |
| `Cmd+Shift+T` / `Ctrl+Shift+T` | New Tab         | Create a new CLI tab       |
| `Cmd+W` / `Ctrl+W`             | Close Tab       | Close the current tab      |
| `Cmd+Shift+[` / `Ctrl+Shift+[` | Previous Tab    | Switch to the previous tab |
| `Cmd+Shift+]` / `Ctrl+Shift+]` | Next Tab        | Switch to the next tab     |

## Keyboard Shortcuts Reference

Complete list of all keyboard shortcuts available in the extension:

### Tab Management

| Shortcut (macOS) | Shortcut (Windows/Linux) | Action            | Command ID                |
| ---------------- | ------------------------ | ----------------- | ------------------------- |
| `Cmd+Shift+T`    | `Ctrl+Shift+T`           | Create new tab    | `opencodeTui.newTab`      |
| `Cmd+W`          | `Ctrl+W`                 | Close current tab | `opencodeTui.closeTab`    |
| `Cmd+1-9`        | `Ctrl+1-9`               | Switch to tab 1-9 | `opencodeTui.switchTab`   |
| `Cmd+Shift+[`    | `Ctrl+Shift+[`           | Previous tab      | `opencodeTui.previousTab` |
| `Cmd+Shift+]`    | `Ctrl+Shift+]`           | Next tab          | `opencodeTui.nextTab`     |

### File References

| Shortcut (macOS) | Shortcut (Windows/Linux) | Action              | Command ID                      |
| ---------------- | ------------------------ | ------------------- | ------------------------------- |
| `Cmd+Alt+L`      | `Ctrl+Alt+L`             | Send file reference | `opencodeTui.sendFileReference` |
| `Cmd+Alt+A`      | `Ctrl+Alt+A`             | Send all open files | `opencodeTui.sendAllOpenFiles`  |

### Terminal Control

| Shortcut (macOS) | Shortcut (Windows/Linux) | Action         | Command ID                  |
| ---------------- | ------------------------ | -------------- | --------------------------- |
| `Cmd+Alt+O`      | `Ctrl+Alt+O`             | Open sidebar   | `opencodeTui.open`          |
| `Cmd+Shift+C`    | `Ctrl+Shift+C`           | Clear terminal | `opencodeTui.clearTerminal` |
| `Cmd+Shift+R`    | `Ctrl+Shift+R`           | Restart CLI    | `opencodeTui.restart`       |

### Custom Keybindings

You can customize any shortcut in VS Code: settings:

```json
{
  "keybindings": [
    {
      "command": "opencodeTui.sendFileReference",
      "key": "cmd+shift+l",
      "when": "editorTextFocus"
    },
    {
      "command": "opencodeTui.newTab",
      "key": "cmd+t",
      "when": "opencodeTuiFocus"
    }
  ]
}
```

## Architecture

This extension provides a **sidebar-only** terminal experience. OpenCode runs embedded in the VS Code: sidebar Activity Bar, not in the native VS Code: terminal panel.

### Communication Architecture

The extension uses a hybrid communication approach:

1. **HTTP API**: Primary communication channel with OpenCode CLI
   - Port range: 16384-65535 (ephemeral ports)
   - Endpoints: `/health`, `/tui/append-prompt`
   - Auto-discovery of OpenCode CLI HTTP server

2. **WebView Messaging**: Terminal I/O between extension host and sidebar WebView
   - xterm.js for terminal rendering
   - Bidirectional message passing for input/output

## Installation

### From VS Code: Marketplace

1. Open VS Code:
2. Go to Extensions (`Cmd+Shift+X` / `Ctrl+Shift+X`)
3. Search for "OpenCode Sidebar TUI"
4. Click **Install**

### From OpenVSX Registry

For VSCodium, Gitpod, Eclipse Theia, and other VS Code:-compatible IDEs:

1. Open your IDE's extension view
2. Search for "OpenCode Sidebar TUI"
3. Click **Install**

Or visit the [OpenVSX page](https://open-vsx.org/extension/islee23520/opencode-sidebar-tui).

### From Source

1. Clone the repository:

```bash
git clone https://github.com/islee23520/opencode-sidebar-tui.git
cd opencode-sidebar-tui
```

2. Install dependencies:

```bash
npm install
```

3. Build the extension:

```bash
npm run compile
```

4. Package the extension:

```bash
npx @vscode/vsce package
```

5. Install in VS Code:

- Open VS Code:
- Go to Extensions (`Cmd+Shift+X` / `Ctrl+Shift+X`)
- Click "..." menu → "Install from VSIX"
- Select the generated `.vsix` file

## Usage

1. Click the OpenCode icon in the Activity Bar (sidebar)
2. OpenCode TUI automatically starts
3. Interact with OpenCode directly in the sidebar

## Commands

### Basic Commands

- **OpenCode TUI: Start OpenCode** - Manually start OpenCode
- **OpenCode TUI: Restart OpenCode** - Restart the OpenCode process
- **OpenCode TUI: Clear Terminal** - Clear the terminal display

### Tab Commands

- **OpenCode TUI: New Tab** - Create a new CLI tab
- **OpenCode TUI: Close Tab** - Close the current tab
- **OpenCode TUI: Next Tab** - Switch to the next tab
- **OpenCode TUI: Previous Tab** - Switch to the previous tab
- **OpenCode TUI: Switch to Tab N** - Jump directly to tab 1-9

### File Reference Commands

- **Send File Reference** (`Cmd+Alt+L` / `Ctrl+Alt+L`) - Send current file with line numbers
  - No selection: `@filename`
  - Single line: `@filename#L10`
  - Multiple lines: `@filename#L10-L20`
- **Send All Open Files** (`Cmd+Alt+A` / `Ctrl+Alt+A`) - Send all open file references
- **Send to OpenCode** - Send selected text or file from context menu

### Context Menu Options

- **Explorer**: Right-click any file or folder → "Send to OpenCode"
- **Editor**: Right-click selected text → "Send to OpenCode Terminal"
- **Editor**: Right-click anywhere → "Send File Reference (@file)"

### Drag & Drop

- Hold **Shift** and drag files/folders to the terminal to send as `@file` references

## HTTP API Integration

The extension communicates with OpenCode CLI via an HTTP API for reliable bidirectional communication:

### Features

- **Auto-Discovery**: Automatically discovers OpenCode CLI HTTP server port
- **Health Checks**: Validates OpenCode CLI availability before sending commands
- **Retry Logic**: Exponential backoff for reliable communication
- **Context Sharing**: Automatically shares editor context on terminal open

### How It Works

1. When OpenCode starts, it launches an HTTP server on an ephemeral port (16384-65535)
2. The extension discovers the port and establishes communication
3. File references and context are sent via HTTP POST to `/tui/append-prompt`
4. Health checks ensure OpenCode is ready before sending data

### Configuration

```json
{
  "opencodeTui.enableHttpApi": true,
  "opencodeTui.httpTimeout": 5000,
  "opencodeTui.autoShareContext": true
}
```

## Auto-Context Sharing

When enabled, the extension automatically shares editor context with OpenCode when the terminal opens:

- **Open Files**: Lists all currently open files
- **Active Selection**: Includes line numbers for selected text
- **Format**: `@path/to/file#L10-L20`

This feature eliminates the need to manually share context when starting a new OpenCode session.

## Configuration

Available settings in VS Code: settings (`Cmd+,` / `Ctrl+,`):

| Setting                        | Type    | Default         | Description                                             |
| ------------------------------ | ------- | --------------- | ------------------------------------------------------- |
| `opencodeTui.autoStart`        | boolean | `true`          | Automatically start OpenCode when the view is activated |
| `opencodeTui.autoStartOnOpen`  | boolean | `true`          | Automatically start OpenCode when sidebar is opened     |
| `opencodeTui.command`          | string  | `"opencode -c"` | Command to launch OpenCode with arguments               |
| `opencodeTui.fontSize`         | number  | `14`            | Terminal font size in pixels (6-25)                     |
| `opencodeTui.fontFamily`       | string  | `"monospace"`   | Terminal font family                                    |
| `opencodeTui.cursorBlink`      | boolean | `true`          | Enable cursor blinking                                  |
| `opencodeTui.cursorStyle`      | string  | `"block"`       | Cursor style: `block`, `underline`, or `bar`            |
| `opencodeTui.scrollback`       | number  | `10000`         | Maximum lines in scrollback buffer (0-100000)           |
| `opencodeTui.autoFocusOnSend`  | boolean | `true`          | Auto-focus sidebar after sending file references        |
| `opencodeTui.shellPath`        | string  | `""`            | Custom shell path (empty = VS Code: default)            |
| `opencodeTui.shellArgs`        | array   | `[]`            | Custom shell arguments                                  |
| `opencodeTui.enableHttpApi`    | boolean | `true`          | Enable HTTP API for OpenCode communication              |
| `opencodeTui.httpTimeout`      | number  | `5000`          | HTTP API request timeout in ms (1000-30000)             |
| `opencodeTui.autoShareContext` | boolean | `true`          | Auto-share editor context with OpenCode                 |
| `opencodeTui.tabs`             | array   | `[]`            | Array of tab configurations for multi-CLI support       |
| `opencodeTui.defaultTab`       | string  | `"opencode"`    | Default tab to open when sidebar is activated           |
| `opencodeTui.persistTabs`      | boolean | `true`          | Save and restore tabs across VS Code: sessions          |

### Example Configuration

#### Basic Setup (Single CLI)

```json
{
  "opencodeTui.autoStart": true,
  "opencodeTui.command": "opencode -c",
  "opencodeTui.fontSize": 14,
  "opencodeTui.fontFamily": "monospace",
  "opencodeTui.cursorBlink": true,
  "opencodeTui.cursorStyle": "block",
  "opencodeTui.scrollback": 10000,
  "opencodeTui.enableHttpApi": true,
  "opencodeTui.httpTimeout": 5000,
  "opencodeTui.autoShareContext": true
}
```

#### Multi-CLI Setup (Multiple Tabs)

```json
{
  "opencodeTui.autoStart": true,
  "opencodeTui.defaultTab": "opencode",
  "opencodeTui.persistTabs": true,
  "opencodeTui.fontSize": 14,
  "opencodeTui.fontFamily": "monospace",
  "opencodeTui.enableHttpApi": true,
  "opencodeTui.httpTimeout": 5000,
  "opencodeTui.tabs": [
    {
      "id": "opencode",
      "name": "OpenCode",
      "command": "opencode -c",
      "color": "#6366F1",
      "autoStart": true
    },
    {
      "id": "claude",
      "name": "Claude",
      "command": "claude",
      "color": "#CC785C",
      "autoStart": false
    },
    {
      "id": "codex",
      "name": "Codex",
      "command": "codex",
      "color": "#74AA9C",
      "autoStart": false
    },
    {
      "id": "gemini",
      "name": "Gemini",
      "command": "gemini",
      "color": "#4285F4",
      "autoStart": false
    }
  ]
}
```

## Requirements

- VS Code: 1.106.0 or higher
- Node.js 20.0.0 or higher
- OpenCode installed and accessible via `opencode` command

## Development

### Build

```bash
npm run compile    # Development build
npm run watch      # Watch mode
npm run package    # Production build
npm run test       # Run tests
npm run test:coverage  # Run tests with coverage
```

### Project Structure

```
opencode-sidebar-tui/
├── src/
│   ├── extension.ts                    # Extension entry point
│   ├── core/
│   │   └── ExtensionLifecycle.ts       # Lifecycle management
│   ├── providers/
│   │   └── OpenCodeTuiProvider.ts      # WebView provider
│   ├── terminals/
│   │   └── TerminalManager.ts          # Terminal process manager
│   ├── services/
│   │   ├── OpenCodeApiClient.ts        # HTTP API client
│   │   ├── PortManager.ts              # Ephemeral port management
│   │   ├── ContextSharingService.ts    # Editor context sharing
│   │   ├── TerminalDiscoveryService.ts # Terminal discovery
│   │   └── OutputCaptureManager.ts     # Output capture
│   └── webview/
│       └── main.ts                     # WebView entry (xterm.js)
├── package.json
├── tsconfig.json
└── webpack.config.js
```

## Implementation Details

Based on the excellent [vscode-sidebar-terminal](https://github.com/s-hiraoku/vscode-sidebar-terminal) extension, streamlined specifically for OpenCode TUI:

- **Terminal Backend**: node-pty for PTY support
- **Terminal Frontend**: xterm.js with WebGL rendering
- **Process Management**: Automatic OpenCode lifecycle
- **Communication**: HTTP API + WebView messaging
- **Port Management**: Ephemeral port allocation (16384-65535)

## License

MIT

## Acknowledgments

- Based on [vscode-sidebar-terminal](https://github.com/s-hiraoku/vscode-sidebar-terminal) by s-hiraoku
- Development assisted by [Sisyphus](https://github.com/code-yeongyu/oh-my-opencode) from oh-my-opencode
- Uses [xterm.js](https://github.com/xtermjs/xterm.js) for terminal emulation
- Uses [node-pty](https://github.com/microsoft/node-pty) for PTY support
