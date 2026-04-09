import { h, FunctionComponent } from "preact";

export interface EmptyStateProps {
  tmuxAvailable?: boolean;
}

export const EmptyState: FunctionComponent<EmptyStateProps> = ({
  tmuxAvailable = true,
}) => {
  const message =
    tmuxAvailable
      ? "No tmux sessions or native shells for this workspace."
      : "No native shells for this workspace.";
  return h(
    "div",
    { class: "empty" },
    message,
  );
};
