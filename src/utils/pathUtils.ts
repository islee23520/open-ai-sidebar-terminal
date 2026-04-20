import { resolve } from "node:path";

export interface NormalizePathOptions {
  caseFolding?: "auto" | "win32-only" | "always" | "never";
  resolveRelative?: boolean;
}

export function normalizeComparablePath(
  pathValue: string | undefined,
  options: NormalizePathOptions = {},
  platform: NodeJS.Platform = process.platform,
): string | undefined {
  const trimmed = pathValue?.trim() ?? "";
  if (!trimmed) {
    return undefined;
  }

  const { caseFolding = "auto", resolveRelative = false } = options;

  let normalized: string;

  if (resolveRelative) {
    const hasDrivePrefix = /^[a-zA-Z]:[/\\]/.test(trimmed);
    const withoutTrailingSlash = trimmed.replace(/[\\/]+$/, "");
    const absolutePath =
      hasDrivePrefix || withoutTrailingSlash.startsWith("/")
        ? withoutTrailingSlash
        : resolve(withoutTrailingSlash);
    normalized = absolutePath.replace(/\\/g, "/");
  } else {
    normalized = trimmed.replace(/\\/g, "/");
  }

  while (normalized.length > 1 && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }

  const shouldFold =
    caseFolding === "always" ||
    (caseFolding === "auto" &&
      (platform === "win32" || platform === "darwin")) ||
    (caseFolding === "win32-only" && platform === "win32");

  if (shouldFold) {
    normalized = normalized.toLowerCase();
  }

  return normalized;
}

/**
 * Host-independent check for Windows absolute paths (drive-letter and UNC).
 * Unlike Node's `path.isAbsolute()`, this works correctly on macOS/Linux hosts.
 */
export function isWindowsAbsolutePath(filePath: string): boolean {
  return /^[a-zA-Z]:[/\\]/.test(filePath) || /^[/\\]{2}/.test(filePath);
}
