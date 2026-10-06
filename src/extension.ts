import * as path from "node:path";
import * as vscode from "vscode";
import { CHECK_SETUP_COMMAND, CLEAR_CACHE_COMMAND, RUN_WITH_ARGS_COMMAND } from "./commands/ids";
import { clearBuildCache, runKotlinFile } from "./commands/run";
import { checkSetup } from "./commands/setup";
import { formatArgs, parseArgs } from "./core/argsParser";
import { KotlinCompletionProvider } from "./providers/completionProvider";
import { RUN_COMMAND, RunCodeLensProvider } from "./providers/runCodeLensProvider";
import { WorkspaceIndex } from "./providers/workspaceIndex";
import { CommandRunner, TerminalRunner } from "./terminal/runTerminal";

const KOTLIN: vscode.DocumentSelector = [
  { language: "kotlin", scheme: "file" },
  { language: "kotlin", scheme: "untitled" },
];

export interface KotlinExtensionApi {
  /** Replaces the terminal runner (used by integration tests). Pass undefined to restore it. */
  setRunner(runner: CommandRunner | undefined): void;
}

export function activate(context: vscode.ExtensionContext): KotlinExtensionApi {
  const defaultRunner = new TerminalRunner();
  let runner: CommandRunner = defaultRunner;
  context.subscriptions.push(defaultRunner);

  const outDir = path.join(context.globalStorageUri.fsPath, "build");
  const index = new WorkspaceIndex();
  context.subscriptions.push(index);
  if (vscode.workspace.getConfiguration("kotlin.completion").get<boolean>("workspaceIndex", true)) {
    void index.start();
  }

  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(KOTLIN, new RunCodeLensProvider()),
    vscode.languages.registerCompletionItemProvider(KOTLIN, new KotlinCompletionProvider(index), "."),
    vscode.commands.registerCommand(RUN_COMMAND, (uri?: vscode.Uri) =>
      runKotlinFile(uri, { outDir, runner: () => runner }),
    ),
    vscode.commands.registerCommand(RUN_WITH_ARGS_COMMAND, async (uri?: vscode.Uri) => {
      const target = uri instanceof vscode.Uri ? uri : vscode.window.activeTextEditor?.document.uri;
      if (!target) {
        void vscode.window.showErrorMessage("Open a Kotlin file to run it.");
        return undefined;
      }
      const key = `foxrun.args:${target.fsPath}`;
      const last = context.workspaceState.get<string[]>(key) ?? vscode.workspace.getConfiguration("kotlin.run", target).get<string[]>("args", []);
      const line = await vscode.window.showInputBox({
        title: "Run with arguments",
        prompt: "Arguments passed to main. Use quotes for values with spaces.",
        value: formatArgs(last),
        validateInput: (text) => parseArgs(text).error,
      });
      if (line === undefined) return undefined;
      const { args } = parseArgs(line);
      await context.workspaceState.update(key, args);
      return runKotlinFile(target, { outDir, runner: () => runner, args });
    }),
    vscode.commands.registerCommand(CHECK_SETUP_COMMAND, () => checkSetup()),
    vscode.commands.registerCommand(CLEAR_CACHE_COMMAND, () => {
      const removed = clearBuildCache(outDir);
      void vscode.window.showInformationMessage(`Cleared ${removed} cached build${removed === 1 ? "" : "s"}.`);
    }),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("kotlin.completion.workspaceIndex")) void index.start();
    }),
  );

  return {
    setRunner(r) {
      runner = r ?? defaultRunner;
    },
  };
}

export function deactivate(): void {}
