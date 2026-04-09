import { postMessage } from "../shared/vscode-api";

interface DropCell {
  col: number;
  row: number;
}

function canonicalizeForDedup(p: string): string {
  let s = p.trim();
  s = s.replace(/\\/g, "/");
  if (/^[A-Za-z]:\//.test(s)) {
    s = s[0].toLowerCase() + s.slice(1);
  }
  if (s.length > 1) {
    s = s.replace(/\/$/, "");
  }
  return s;
}

function extractFilePathFromValue(value: string): string | null {
  const candidate = value.trim();

  if (!candidate || candidate.startsWith("#")) {
    return null;
  }

  try {
    const url = new URL(candidate);

    if (url.protocol === "file:") {
      const decodedPath = decodeURIComponent(url.pathname);
      const hasWindowsDrivePrefix =
        decodedPath.length >= 3 &&
        decodedPath[0] === "/" &&
        /[A-Za-z]/.test(decodedPath[1] ?? "") &&
        decodedPath[2] === ":";

      return hasWindowsDrivePrefix ? decodedPath.slice(1) : decodedPath;
    }
  } catch {
    const hasWindowsDrivePath =
      candidate.length >= 3 &&
      /[A-Za-z]/.test(candidate[0] ?? "") &&
      candidate[1] === ":" &&
      (candidate[2] === "\\" || candidate[2] === "/");

    if (candidate.startsWith("/") || hasWindowsDrivePath) {
      return candidate;
    }
  }

  return null;
}

function parseDroppedText(payload: string): string[] {
  const paths: string[] = [];
  const lines = payload
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  for (const line of lines) {
    const filePath = extractFilePathFromValue(line);
    if (filePath) {
      paths.push(filePath);
    }
  }

  if (paths.length > 0) {
    return paths;
  }

  try {
    const parsed = JSON.parse(payload) as unknown;
    const stack: unknown[] = [parsed];

    while (stack.length > 0) {
      const current = stack.pop();

      if (typeof current === "string") {
        const filePath = extractFilePathFromValue(current);
        if (filePath) {
          paths.push(filePath);
        }
        continue;
      }

      if (Array.isArray(current)) {
        stack.push(...current);
        continue;
      }

      if (current && typeof current === "object") {
        stack.push(...Object.values(current as Record<string, unknown>));
      }
    }
  } catch {}

  return paths;
}

export async function handleDrop(
  event: DragEvent,
  options: {
    getTerminalCols: () => number;
    getTerminalRows: () => number;
    getScreenElement: () => Element | null;
  },
): Promise<void> {
  if (!event.dataTransfer) return;

  const transferTypes = Array.from(event.dataTransfer.types ?? []);
  const transferItems = Array.from(event.dataTransfer.items ?? []);

  console.log("Drop event dataTransfer.types:", transferTypes);
  console.log("Drop event dataTransfer.items:", transferItems.length);

  const files: string[] = [];
  const seen = new Set<string>();

  const addFile = (filePath: string | null | undefined) => {
    const trimmed = filePath?.trim();
    if (!trimmed) return;

    const canonical = canonicalizeForDedup(trimmed);
    if (!canonical || seen.has(canonical)) return;

    seen.add(canonical);
    files.push(canonical);
  };

  const readItemString = (item: DataTransferItem): Promise<string> =>
    new Promise((resolve) => {
      item.getAsString((value) => resolve(value ?? ""));
    });

  const uriList = event.dataTransfer.getData("text/uri-list");
  if (uriList) {
    const uriListPaths = parseDroppedText(uriList);
    for (const uriListPath of uriListPaths) {
      addFile(uriListPath);
    }
  }

  const hasVsCodeInternalType = transferTypes.some((type) =>
    type.startsWith("application/vnd.code."),
  );

  if (hasVsCodeInternalType || files.length === 0) {
    for (const item of transferItems) {
      if (item.kind !== "string") continue;

      if (
        item.type === "text/uri-list" ||
        item.type === "text/plain" ||
        item.type.startsWith("application/vnd.code.")
      ) {
        const payload = await readItemString(item);
        const payloadPaths = parseDroppedText(payload);

        for (const payloadPath of payloadPaths) {
          addFile(payloadPath);
        }
      }
    }
  }

  if (event.dataTransfer.files.length > 0) {
    for (const file of Array.from(event.dataTransfer.files)) {
      const filePath = (file as File & { path?: string }).path || file.name;
      addFile(filePath);
    }
  }

  if (files.length === 0) {
    for (let i = 0; i < event.dataTransfer.items.length; i++) {
      const item = event.dataTransfer.items[i];
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) {
          const filePath = (file as File & { path?: string }).path || file.name;
          addFile(filePath);
        }
      }
    }
  }

  if (files.length > 0) {
    console.log(`[WEBVIEW] Sending ${files.length} files:`, files);

    let dropCell: DropCell | undefined;
    if (event.shiftKey) {
      const screenEl = options.getScreenElement();
      if (screenEl) {
        const rect = screenEl.getBoundingClientRect();
        const relX = event.clientX - rect.left;
        const relY = event.clientY - rect.top;
        const cols = options.getTerminalCols();
        const rows = options.getTerminalRows();

        if (
          relX >= 0 &&
          relY >= 0 &&
          relX < rect.width &&
          relY < rect.height &&
          cols > 0 &&
          rows > 0
        ) {
          dropCell = {
            col: Math.floor((relX / rect.width) * cols),
            row: Math.floor((relY / rect.height) * rows),
          };
          console.log(`[WEBVIEW] dropCell computed:`, dropCell);
        }
      }
    }

    postMessage({
      type: "filesDropped",
      files: files,
      shiftKey: event.shiftKey,
      dropCell,
    });
  } else {
    console.log("[WEBVIEW] No files collected from drop event");
  }
}
