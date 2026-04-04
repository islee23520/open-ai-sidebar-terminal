import { h, FunctionComponent } from "preact";

export const EmptyState: FunctionComponent = () => {
  return h(
    "div",
    { class: "empty" },
    "No tmux sessions or native shells for this workspace.",
  );
};
