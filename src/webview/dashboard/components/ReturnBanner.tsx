import { h, FunctionComponent } from "preact";

import { escapeHtml } from "../utils";

export interface ReturnBannerProps {
  workspace: string;
  onReturn: () => void;
  onCreate: () => void;
}

export const ReturnBanner: FunctionComponent<ReturnBannerProps> = ({
  workspace,
  onReturn,
  onCreate,
}) => {
  return h(
    "div",
    { id: "return-banner", class: "return-banner" },
    h(
      "span",
      null,
      "Active session is in another workspace. Return to ",
      h("span", {
        id: "return-workspace",
        dangerouslySetInnerHTML: {
          __html: escapeHtml(workspace || "current workspace"),
        },
      }),
      "?",
    ),
    h(
      "div",
      { class: "pane-actions" },
      h(
        "button",
        {
          type: "button",
          id: "return-btn",
          class: "primary",
          onClick: (): void => {
            onReturn();
          },
        },
        "Return",
      ),
      h(
        "button",
        {
          type: "button",
          "data-action": "create",
          onClick: (): void => {
            onCreate();
          },
        },
        "Create here",
      ),
    ),
  );
};
