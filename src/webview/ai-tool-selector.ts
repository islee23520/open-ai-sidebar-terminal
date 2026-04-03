/**
 * Shared AI Tool Selector logic for webviews.
 * Used by both the terminal webview (main.ts) and the dashboard webview (dashboard-manager.ts).
 */

export interface AiToolConfig {
  name: string;
  label: string;
  path: string;
  args: string[];
}

export interface AiToolSelectorCallbacks {
  postMessage: (message: unknown) => void;
}

let visible = false;
let focusedIndex = 0;
let sessionId: string | null = null;
let tools: AiToolConfig[] = [];

function escapeHtml(value: string | number | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function show(
  id: string,
  sessionName: string,
  defaultTool: string | undefined,
  toolList: AiToolConfig[] | undefined,
): void {
  if (toolList && toolList.length > 0) {
    tools = toolList;
  }
  sessionId = id;
  visible = true;
  focusedIndex = defaultTool
    ? tools.findIndex((t) => t.name === defaultTool)
    : 0;
  if (focusedIndex < 0) {
    focusedIndex = 0;
  }

  const optionsContainer = document.getElementById("ai-tool-options");
  const subtitleEl = document.getElementById("ai-selector-session");
  if (subtitleEl) {
    subtitleEl.textContent = "Session: " + sessionName;
  }

  if (optionsContainer) {
    optionsContainer.innerHTML = tools
      .map((t, idx) => {
        const focusedClass = idx === focusedIndex ? " focused" : "";
        return `<div class="ai-tool-option${focusedClass}" data-tool-id="${escapeHtml(t.name)}" data-tool-command="${escapeHtml(t.path || t.name)}"><div class="ai-tool-icon ${escapeHtml(t.name)}">${escapeHtml(t.label.charAt(0))}</div><span class="ai-tool-label">${escapeHtml(t.label)}</span><span class="ai-tool-command">${escapeHtml(t.path || t.name)}</span></div>`;
      })
      .join("");
  }

  const saveCheckbox = document.getElementById("ai-save-default");
  if (saveCheckbox) {
    (saveCheckbox as HTMLInputElement).checked = false;
  }

  const backdrop = document.getElementById("ai-selector");
  if (backdrop) {
    backdrop.style.display = "flex";
  }
}

export function hide(): void {
  visible = false;
  sessionId = null;
  const backdrop = document.getElementById("ai-selector");
  if (backdrop) {
    backdrop.style.display = "none";
  }
}

export function isVisible(): boolean {
  return visible;
}

export function updateFocus(): void {
  const options = document.querySelectorAll(".ai-tool-option");
  options.forEach((el, idx) => {
    if (idx === focusedIndex) {
      el.classList.add("focused");
      el.scrollIntoView({ block: "nearest" });
    } else {
      el.classList.remove("focused");
    }
  });
}

export function select(callbacks: AiToolSelectorCallbacks): void {
  if (!sessionId) return;
  const tool = tools[focusedIndex];
  if (!tool) return;
  const saveCheckbox = document.getElementById("ai-save-default");
  const savePref = (saveCheckbox as HTMLInputElement)?.checked ?? false;
  callbacks.postMessage({
    action: "launchAiTool",
    sessionId,
    tool: tool.name,
    savePreference: savePref,
  });
  hide();
}

export function handleKeydown(
  event: KeyboardEvent,
  callbacks: AiToolSelectorCallbacks,
): boolean {
  if (!visible) return false;

  if (event.key === "ArrowDown") {
    event.preventDefault();
    focusedIndex = (focusedIndex + 1) % tools.length;
    updateFocus();
    return true;
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    focusedIndex = (focusedIndex - 1 + tools.length) % tools.length;
    updateFocus();
    return true;
  }
  if (event.key === "Enter") {
    event.preventDefault();
    select(callbacks);
    return true;
  }
  if (event.key === "Escape") {
    event.preventDefault();
    hide();
    return true;
  }
  return false;
}

export function handleClick(
  target: Element,
  callbacks: AiToolSelectorCallbacks,
): boolean {
  if (target.closest(".ai-tool-option")) {
    const toolOption = target.closest(".ai-tool-option");
    if (toolOption instanceof HTMLElement && toolOption.dataset.toolId) {
      // Find index and select
      const idx = tools.findIndex((t) => t.name === toolOption.dataset.toolId);
      if (idx >= 0) {
        focusedIndex = idx;
        select(callbacks);
      }
    }
    return true;
  }

  // Click on backdrop dismisses
  if (target.id === "ai-selector" && !target.closest(".ai-selector-card")) {
    hide();
    return true;
  }

  return false;
}

export function setTools(toolList: AiToolConfig[]): void {
  if (toolList && toolList.length > 0) {
    tools = toolList;
  }
}
