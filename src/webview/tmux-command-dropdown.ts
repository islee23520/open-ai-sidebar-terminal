import { escapeHtml } from "./dashboard/utils";

export interface DropdownCallbacks {
  postMessage: (message: unknown) => void;
}

interface TmuxCommand {
  action: string;
  label: string;
  category: string;
  requiresSession: boolean;
  buildMessage: (activeSessionId: string | null) => Record<string, unknown>;
}

let visible = false;
let query = "";
let focusedIndex = 0;
let activeSessionId: string | null = null;
let callbacks: DropdownCallbacks | null = null;

const commands: TmuxCommand[] = [
  {
    action: "refresh",
    label: "Refresh",
    category: "Dashboard",
    requiresSession: false,
    buildMessage: () => ({ action: "refresh" }),
  },
  {
    action: "toggleScope",
    label: "Toggle Workspace / Global",
    category: "Dashboard",
    requiresSession: false,
    buildMessage: () => ({ action: "toggleScope" }),
  },
  {
    action: "create",
    label: "New Session",
    category: "Session",
    requiresSession: false,
    buildMessage: () => ({ action: "create" }),
  },
  {
    action: "createNativeShell",
    label: "New Shell",
    category: "Shell",
    requiresSession: false,
    buildMessage: () => ({ action: "createNativeShell" }),
  },
  {
    action: "switchNativeShell",
    label: "Switch to Shell",
    category: "Shell",
    requiresSession: false,
    buildMessage: () => ({ action: "switchNativeShell" }),
  },
  {
    action: "createWindow",
    label: "New Window",
    category: "Window",
    requiresSession: true,
    buildMessage: (sid) => ({ action: "createWindow", sessionId: sid! }),
  },
  {
    action: "nextWindow",
    label: "Next Window",
    category: "Window",
    requiresSession: true,
    buildMessage: (sid) => ({ action: "nextWindow", sessionId: sid! }),
  },
  {
    action: "prevWindow",
    label: "Previous Window",
    category: "Window",
    requiresSession: true,
    buildMessage: (sid) => ({ action: "prevWindow", sessionId: sid! }),
  },
  {
    action: "splitPane H",
    label: "Split Horizontal",
    category: "Pane",
    requiresSession: true,
    buildMessage: (sid) => ({
      action: "splitPane",
      sessionId: sid!,
      direction: "h",
    }),
  },
  {
    action: "splitPane V",
    label: "Split Vertical",
    category: "Pane",
    requiresSession: true,
    buildMessage: (sid) => ({
      action: "splitPane",
      sessionId: sid!,
      direction: "v",
    }),
  },
];

function getFilteredCommands(): TmuxCommand[] {
  const q = query.toLowerCase();
  return commands.filter(
    (cmd) =>
      cmd.label.toLowerCase().includes(q) ||
      cmd.category.toLowerCase().includes(q),
  );
}

function renderList(): void {
  const listContainer = document.getElementById("tmux-command-list");
  if (!listContainer) return;

  const filtered = getFilteredCommands();

  if (filtered.length === 0) {
    listContainer.innerHTML = `<div class="tmux-cmd-item disabled"><span class="tmux-cmd-label">No commands found</span></div>`;
    return;
  }

  listContainer.innerHTML = filtered
    .map((cmd, idx) => {
      const isFocused = idx === focusedIndex;
      const isDisabled = cmd.requiresSession && !activeSessionId;
      const focusedClass = isFocused ? " focused" : "";
      const disabledClass = isDisabled ? " disabled" : "";

      return `<div class="tmux-cmd-item${focusedClass}${disabledClass}" data-cmd-index="${idx}">
      <span class="tmux-cmd-category">${escapeHtml(cmd.category)}</span>
      <span class="tmux-cmd-label">${escapeHtml(cmd.label)}</span>
    </div>`;
    })
    .join("");
}

export function show(sessionId: string | null, cb: DropdownCallbacks): void {
  activeSessionId = sessionId;
  callbacks = cb;
  visible = true;
  query = "";
  focusedIndex = 0;

  const dropdown = document.getElementById("tmux-command-dropdown");
  if (dropdown) {
    dropdown.style.display = "flex";
  }

  const searchInput = document.getElementById(
    "tmux-cmd-search-input",
  ) as HTMLInputElement;
  if (searchInput) {
    searchInput.value = "";
    searchInput.focus();

    // Add input listener if not already added
    if (!searchInput.dataset.listenerAdded) {
      searchInput.addEventListener("input", (e) => {
        query = (e.target as HTMLInputElement).value;
        focusedIndex = 0;
        renderList();
      });
      searchInput.dataset.listenerAdded = "true";
    }
  }

  renderList();
}

export function hide(): void {
  visible = false;
  activeSessionId = null;
  callbacks = null;

  const dropdown = document.getElementById("tmux-command-dropdown");
  if (dropdown) {
    dropdown.style.display = "none";
  }
}

export function isVisible(): boolean {
  return visible;
}

export function updateFocus(): void {
  const options = document.querySelectorAll(".tmux-cmd-item:not(.disabled)");
  options.forEach((el) => {
    const idx = parseInt((el as HTMLElement).dataset.cmdIndex || "-1", 10);
    if (idx === focusedIndex) {
      el.classList.add("focused");
      el.scrollIntoView({ block: "nearest" });
    } else {
      el.classList.remove("focused");
    }
  });
}

function selectCommand(index: number): void {
  if (!callbacks) return;

  const filtered = getFilteredCommands();
  const cmd = filtered[index];
  if (!cmd) return;

  if (cmd.requiresSession && !activeSessionId) return;

  callbacks.postMessage(cmd.buildMessage(activeSessionId));
  hide();
}

export function handleKeydown(event: KeyboardEvent): boolean {
  if (!visible) {
    return false;
  }

  const filtered = getFilteredCommands();

  if (event.key === "ArrowDown") {
    event.preventDefault();
    if (filtered.length > 0) {
      focusedIndex = (focusedIndex + 1) % filtered.length;
      updateFocus();
    }
    return true;
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    if (filtered.length > 0) {
      focusedIndex = (focusedIndex - 1 + filtered.length) % filtered.length;
      updateFocus();
    }
    return true;
  }
  if (event.key === "Enter") {
    event.preventDefault();
    selectCommand(focusedIndex);
    return true;
  }
  if (event.key === "Escape") {
    event.preventDefault();
    hide();
    return true;
  }
  if (
    event.key === "/" &&
    document.activeElement?.id !== "tmux-cmd-search-input"
  ) {
    event.preventDefault();
    const searchInput = document.getElementById(
      "tmux-cmd-search-input",
    ) as HTMLInputElement;
    if (searchInput) {
      searchInput.focus();
    }
    return true;
  }

  return false;
}

export function handleClick(target: Element): boolean {
  if (!visible) return false;

  const item = target.closest(".tmux-cmd-item");
  if (item instanceof HTMLElement && item.dataset.cmdIndex) {
    const idx = parseInt(item.dataset.cmdIndex, 10);
    if (!isNaN(idx)) {
      selectCommand(idx);
    }
    return true;
  }

  return false;
}
