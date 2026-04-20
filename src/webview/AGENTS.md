# WEBVIEW KNOWLEDGE BASE

## OVERVIEW

Browser-sandbox code. xterm.js rendering, DOM events, host messaging via `acquireVsCodeApi()`.

## WHERE TO LOOK

| Task                  | Location                | Notes                                     |
| --------------------- | ----------------------- | ----------------------------------------- |
| Terminal UI bootstrap | `main.ts`               | xterm.js + WebGL + fit/resize             |
| Dashboard UI          | `dashboard-manager.tsx` | Preact-based Terminal Manager dashboard    |

## CONVENTIONS

- Browser APIs only — no `fs`, `path`, `os`
- Host communication → discriminated message payloads (`WebviewMessage`, `HostMessage`)
- Keep renderer stateless/light — data shaping belongs in providers/services
- xterm sizing/refresh → timing-sensitive; preserve `fit()` → `refresh()` order

## ANTI-PATTERNS

- No extension-host logic here
- No hardcoding shared message contracts outside of `src/types.ts`
- No ad hoc DOM updates that bypass existing render flow

## BUILD

Webpack produces 2 webview bundles:

- `dist/webview.js` — `src/webview/main.ts` entry (xterm terminal)
- `dist/dashboard.js` — `src/webview/dashboard-manager.tsx` entry (Terminal Manager dashboard)
