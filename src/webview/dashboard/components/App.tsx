import { h, FunctionComponent, Fragment } from "preact";
import { useState } from "preact/hooks";

import * as AiTool from "../../ai-tool-selector";
import { DashboardPayload } from "../types";
import { EmptyState } from "./EmptyState";
import { NativeShellCard } from "./NativeShellCard";
import { ReturnBanner } from "./ReturnBanner";
import { SessionCard } from "./SessionCard";

type AiToolConfig = AiTool.AiToolConfig;

export interface AppProps {
  payload: DashboardPayload;
  aiTools: AiToolConfig[];
  onAction: (action: Record<string, unknown>) => void;
}

export const App: FunctionComponent<AppProps> = ({
  payload,
  aiTools,
  onAction,
}) => {
  const sessions = Array.isArray(payload.sessions) ? payload.sessions : [];
  const nativeShells = Array.isArray(payload.nativeShells)
    ? payload.nativeShells
    : [];
  const activeOther = sessions.find(
    (session) => session.isActive && session.workspace !== payload.workspace,
  );

  const [isAiSelectorVisible, setAiSelectorVisible] = useState<boolean>(() =>
    AiTool.isVisible(),
  );

  const handleAction = (action: Record<string, unknown>): void => {
    const actionName =
      typeof action.action === "string" ? action.action : undefined;

    if (actionName === "showAiToolSelector") {
      const sessionId =
        typeof action.sessionId === "string" ? action.sessionId : "";
      const sessionName =
        typeof action.sessionName === "string" ? action.sessionName : "";
      const defaultTool =
        typeof action.defaultTool === "string" ? action.defaultTool : undefined;
      const tools = Array.isArray(action.tools)
        ? (action.tools as AiToolConfig[])
        : aiTools;

      AiTool.show(sessionId, sessionName, defaultTool, tools);
      setAiSelectorVisible(true);
      return;
    }

    if (actionName === "hideAiToolSelector" || isAiSelectorVisible) {
      if (actionName === "hideAiToolSelector") {
        AiTool.hide();
        setAiSelectorVisible(false);
        return;
      }
    }

    onAction(action);
  };

  if (sessions.length === 0 && nativeShells.length === 0) {
    return h(EmptyState, null);
  }

  return h(
    Fragment,
    null,
    activeOther
      ? h(ReturnBanner, {
          workspace: payload.workspace || "current workspace",
          onReturn: (): void => {
            const matching = sessions.find(
              (session) => session.workspace === payload.workspace,
            );
            if (matching) {
              handleAction({ action: "activate", sessionId: matching.id });
              return;
            }
            handleAction({ action: "create" });
          },
          onCreate: (): void => {
            handleAction({ action: "create" });
          },
        })
      : null,
    nativeShells.map((shell) =>
      h(NativeShellCard, {
        key: shell.id,
        shell,
        onActivate: (instanceId): void => {
          handleAction({ action: "activateNativeShell", instanceId });
        },
        onKill: (instanceId): void => {
          handleAction({ action: "killNativeShell", instanceId });
        },
      }),
    ),
    sessions.map((session) =>
      h(SessionCard, {
        key: session.id,
        session,
        onActivate: (sessionId): void => {
          handleAction({ action: "activate", sessionId });
        },
        onKill: (sessionId): void => {
          handleAction({ action: "killSession", sessionId });
        },
      }),
    ),
  );
};
