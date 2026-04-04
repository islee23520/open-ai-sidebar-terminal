import type { Terminal } from "@xterm/xterm";
import { postMessage } from "../shared/vscode-api";

interface Link {
  text: string;
  range: {
    start: { x: number; y: number };
    end: { x: number; y: number };
  };
  activate: () => void;
}

const MAX_LINE_LENGTH = 10000;

const PATH_REGEX =
  /(?:^[\s"'])(@?((?:file:\/\/|\/|[A-Za-z]:\\|\.?\.?\/)[^\s"'#]+|[^\s":\/]+(?:\/[^\s":\/]+)+)(?:#L(\d+)(?:-L?(\d+))?)?)(?=[\s"']|$)/gi;

export function createLinkProvider(terminal: Terminal) {
  return {
    provideLinks(
      bufferLineNumber: number,
      callback: (links: Link[] | undefined) => void,
    ) {
      const line = terminal.buffer.active.getLine(bufferLineNumber);
      if (!line) {
        callback(undefined);
        return;
      }

      const lineText = line.translateToString(true);

      if (lineText.length > MAX_LINE_LENGTH) {
        callback(undefined);
        return;
      }

      const links: Link[] = [];
      let match: RegExpExecArray | null = PATH_REGEX.exec(lineText);
      let lastIndex = -1;

      while (match) {
        if (match.index === lastIndex) {
          PATH_REGEX.lastIndex++;
          match = PATH_REGEX.exec(lineText);
          continue;
        }
        lastIndex = match.index;

        const fullMatch = match[1];
        const hasAtPrefix = fullMatch.startsWith("@");
        let path = match[2];
        const lineNumStr = match[3];
        const endLineStr = match[4];

        if (!path) continue;

        let lineNumber: number | undefined;
        let columnNumber: number | undefined;
        let endLineNumber: number | undefined;

        if (path.startsWith("file://")) {
          try {
            const url = new URL(path);
            path = decodeURIComponent(url.pathname);
            if (url.hostname && !url.pathname.startsWith("/")) {
              path = `${url.hostname}:${path}`;
            }
          } catch {
            continue;
          }
        }

        if (lineNumStr) {
          lineNumber = parseInt(lineNumStr, 10);
        }
        if (endLineStr) {
          endLineNumber = parseInt(endLineStr, 10);
        }

        if (!hasAtPrefix && !lineNumStr) {
          const posRegex = /^(.*?):(\d+)(?::(\d+))?$/;
          const posMatch = path.match(posRegex);
          if (posMatch) {
            path = posMatch[1];
            lineNumber = parseInt(posMatch[2], 10);
            if (posMatch[3]) {
              columnNumber = parseInt(posMatch[3], 10);
            }
          }
        }

        const index = match.index + (match[0].length - fullMatch.length);

        links.push({
          text: fullMatch,
          range: {
            start: { x: index + 1, y: bufferLineNumber },
            end: { x: index + fullMatch.length, y: bufferLineNumber },
          },
          activate: () => {
            postMessage({
              type: "openFile",
              path: path,
              line: lineNumber,
              endLine: endLineNumber,
              column: columnNumber,
            });
          },
        });

        match = PATH_REGEX.exec(lineText);
      }

      callback(links);
    },
  };
}
