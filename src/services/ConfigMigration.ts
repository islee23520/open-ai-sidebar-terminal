import * as vscode from "vscode";
import { OutputChannelService } from "./OutputChannelService";

export class ConfigMigration {
  private static readonly MIGRATION_DONE_KEY = "migrationDone";

  public static async migrate(): Promise<void> {
    const config = vscode.workspace.getConfiguration("opencodeTui");
    const logger = OutputChannelService.getInstance();

    if (config.get<boolean>(this.MIGRATION_DONE_KEY, false)) {
      return;
    }

    logger.info("Checking for configuration migration...");

    let migrated = false;

    const commandInspect = config.inspect<string>("command");
    if (commandInspect) {
      if (commandInspect.globalValue !== undefined) {
        await config.update(
          "tools.opencode.command",
          commandInspect.globalValue,
          vscode.ConfigurationTarget.Global,
        );
        migrated = true;
      }
      if (commandInspect.workspaceValue !== undefined) {
        await config.update(
          "tools.opencode.command",
          commandInspect.workspaceValue,
          vscode.ConfigurationTarget.Workspace,
        );
        migrated = true;
      }
    }

    const shellPathInspect = config.inspect<string>("shellPath");
    if (shellPathInspect) {
      if (shellPathInspect.globalValue !== undefined) {
        await config.update(
          "tools.opencode.shellPath",
          shellPathInspect.globalValue,
          vscode.ConfigurationTarget.Global,
        );
        migrated = true;
      }
      if (shellPathInspect.workspaceValue !== undefined) {
        await config.update(
          "tools.opencode.shellPath",
          shellPathInspect.workspaceValue,
          vscode.ConfigurationTarget.Workspace,
        );
        migrated = true;
      }
    }

    const shellArgsInspect = config.inspect<string[]>("shellArgs");
    if (shellArgsInspect) {
      if (shellArgsInspect.globalValue !== undefined) {
        await config.update(
          "tools.opencode.shellArgs",
          shellArgsInspect.globalValue,
          vscode.ConfigurationTarget.Global,
        );
        migrated = true;
      }
      if (shellArgsInspect.workspaceValue !== undefined) {
        await config.update(
          "tools.opencode.shellArgs",
          shellArgsInspect.workspaceValue,
          vscode.ConfigurationTarget.Workspace,
        );
        migrated = true;
      }
    }

    if (migrated) {
      logger.info("Configuration migrated to new multi-tool format");
      vscode.window.showInformationMessage(
        "OpenCode configuration has been migrated to the new multi-tool format.",
      );
    }

    await config.update(
      this.MIGRATION_DONE_KEY,
      true,
      vscode.ConfigurationTarget.Global,
    );
    logger.info("Configuration migration check completed");
  }
}
