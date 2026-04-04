import { h, FunctionComponent } from "preact";

import { escapeHtml } from "../utils";

export interface SessionPreviewProps {
  preview: string;
}

export const SessionPreview: FunctionComponent<SessionPreviewProps> = ({
  preview,
}) => {
  if (!preview || preview.trim().length === 0) {
    return h("div", { class: "session-preview empty" }, "No preview available");
  }

  const lines = preview
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .slice(-10);

  return h(
    "div",
    { class: "session-preview" },
    lines.map((line, index) =>
      h("div", {
        key: index,
        class: "preview-line",
        dangerouslySetInnerHTML: { __html: escapeHtml(line) },
      }),
    ),
  );
};
