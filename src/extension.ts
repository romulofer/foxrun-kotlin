import * as path from "node:path";
import * as vscode from "vscode";
import { CommandRunner, runKotlinFile, TerminalRunner } from "./commands/run";
import { KotlinCompletionProvider } from "./providers/completionProvider";
import { RUN_COMMAND, RunCodeLensProvider } from "./providers/runCodeLensProvider";
import { WorkspaceIndex } from "./providers/workspaceIndex";

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

  const index = new WorkspaceIndex();
  context.subscriptions.push(index);
  if (vscode.workspace.getConfiguration("kotlin.completion").get<boolean>("workspaceIndex", true)) {
    void index.start();
  }

  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(KOTLIN, new RunCodeLensProvider()),
    vscode.languages.registerCompletionItemProvider(KOTLIN, new KotlinCompletionProvider(index), "."),
    vscode.commands.registerCommand(RUN_COMMAND, (uri?: vscode.Uri) =>
      runKotlinFile(uri, {
        outDir: path.join(context.globalStorageUri.fsPath, "build"),
        runner: () => runner,
      }),
    ),
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
