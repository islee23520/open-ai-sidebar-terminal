import { h, FunctionComponent } from "preact";

import { TmuxDashboardSessionDto } from "../types";
import { escapeHtml } from "../utils";
import { SessionPreview } from "./SessionPreview";

export interface SessionCardProps {
  session: TmuxDashboardSessionDto;
  onActivate: (sessionId: string) => void;
  onKill: (sessionId: string) => void;
}

export const SessionCard: FunctionComponent<SessionCardProps> = ({
  session,
  onActivate,
  onKill,
}) => {
  const activeClass = session.isActive ? " active" : "";
  const statusText = session.isActive ? "Current" : "Available";

  return h(
    "div",
    {
      class: `session-card${activeClass}`,
      "data-session-id": session.id,
      onClick: (): void => {
        onActivate(session.id);
      },
    },
    h(
      "div",
      { class: "row" },
      h(
        "div",
        null,
        h("strong", {
          dangerouslySetInnerHTML: { __html: escapeHtml(session.name) },
        }),
        h("div", {
          class: "status",
          dangerouslySetInnerHTML: { __html: escapeHtml(statusText) },
        }),
      ),
      h(
        "button",
        {
          type: "button",
          class: "danger",
          "data-action": "killSession",
          "data-session-id": session.id,
          title: "Kill Session",
          onClick: (event: MouseEvent): void => {
            event.stopPropagation();
            onKill(session.id);
          },
        },
        "✕",
      ),
    ),
    h(
      "div",
      { class: "meta-grid" },
      h("div", {
        class: "meta",
        dangerouslySetInnerHTML: {
          __html: `tmux session: ${escapeHtml(session.id)}`,
        },
      }),
      h("div", {
        class: "meta",
        dangerouslySetInnerHTML: {
          __html: `workspace: ${escapeHtml(session.workspace)}`,
        },
      }),
    ),
    session.preview ? h(SessionPreview, { preview: session.preview }) : null,
  );
};
