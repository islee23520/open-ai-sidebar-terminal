import * as AiTool from "../ai-tool-selector";

type AiToolConfig = AiTool.AiToolConfig;

export function detectToolIcon(
  currentCommand: string | undefined,
  aiTools: AiToolConfig[],
): string {
  if (!currentCommand || aiTools.length === 0) {
    return "";
  }

  for (const tool of aiTools) {
    const patterns = [tool.name, tool.name + ".exe"];
    if (tool.path) {
      const basename = tool.path
        .split("/")
        .pop()
        ?.split("\\")
        .pop()
        ?.replace(/\.exe$/i, "");
      if (basename && basename !== tool.name) {
        patterns.push(basename);
      }
    }

    for (const pattern of patterns) {
      if (currentCommand.indexOf(pattern) !== -1) {
        return `<span class="pane-tool-badge ${escapeHtml(tool.name)}">${escapeHtml(tool.label.charAt(0))}</span>`;
      }
    }
  }

  return "";
}

export function escapeHtml(value: string | number | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
