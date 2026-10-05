import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import { findExecutable } from "../core/executable";
import { analyzeFile, facadeClassName } from "../core/mainDetector";
import { buildRunCommand, isScript, RunSettings, shellKindFor } from "../core/runCommand";

export const TERMINAL_NAME = "Kotlin Run";

/** Executes a shell command line. Swappable so tests can observe runs without a terminal. */
export interface CommandRunner {
  run(commandLine: string, cwd: string, fresh: boolean): void;
}

export class TerminalRunner implements CommandRunner {
  run(commandLine: string, cwd: string, fresh: boolean): void {
    let terminal = vscode.window.terminals.find((t) => t.name === TERMINAL_NAME && t.exitStatus === undefined);
    if (terminal && fresh) {
      terminal.dispose();
      terminal = undefined;
    }
    terminal ??= vscode.window.createTerminal({ name: TERMINAL_NAME, cwd });
    terminal.show(true);
    terminal.sendText(commandLine, true);
  }
}

export interface RunOptions {
  /** Directory for compiled jars. */
  outDir: string;
  runner: () => CommandRunner;
}

/**
 * Saves and runs a Kotlin file. Returns the command line that was sent to the runner,
 * or undefined when the run was aborted (an error message has been shown).
 */
export async function runKotlinFile(target: vscode.Uri | undefined, options: RunOptions): Promise<string | undefined> {
  const document = await resolveDocument(target);
  if (!document) {
    void vscode.window.showErrorMessage("Open a Kotlin file to run it.");
    return undefined;
  }
  if (document.isUntitled) {
    void vscode.window.showErrorMessage("Save the file before running it.");
    return undefined;
  }
  if (document.isDirty && !(await document.save())) {
    void vscode.window.showErrorMessage(`Could not save ${path.basename(document.fileName)}.`);
    return undefined;
  }

  const filePath = document.uri.fsPath;
  const script = isScript(filePath);
  const info = analyzeFile(document.getText());
  if (!script && info.mains.length === 0) {
    void vscode.window.showErrorMessage(`No main function found in ${path.basename(filePath)}.`);
    return undefined;
  }

  const settings = readSettings(document.uri);
  const required: [string, string][] = [[settings.kotlincPath, "kotlin.run.kotlincPath"]];
  if (!script) required.push([settings.javaPath, "kotlin.run.javaPath"]);
  for (const [exe, setting] of required) {
    if (!findExecutable(exe, process.env, process.platform)) {
      void showMissingExecutable(exe, setting);
      return undefined;
    }
  }

  fs.mkdirSync(options.outDir, { recursive: true });
  const commandLine = buildRunCommand(
    { filePath, mainClass: facadeClassName(filePath, info), outDir: options.outDir },
    settings,
    shellKindFor(vscode.env.shell, process.platform),
  );
  const fresh = vscode.workspace.getConfiguration("kotlin.run", document.uri).get<boolean>("clearTerminal", true);
  options.runner().run(commandLine, path.dirname(filePath), fresh);
  return commandLine;
}

async function resolveDocument(target: vscode.Uri | undefined): Promise<vscode.TextDocument | undefined> {
  const uri = target instanceof vscode.Uri ? target : vscode.window.activeTextEditor?.document.uri;
  if (!uri) return undefined;
  const document = await vscode.workspace.openTextDocument(uri);
  return document.languageId === "kotlin" ? document : undefined;
}

function readSettings(uri: vscode.Uri): RunSettings {
  const config = vscode.workspace.getConfiguration("kotlin.run", uri);
  return {
    kotlincPath: config.get<string>("kotlincPath") || "kotlinc",
    javaPath: config.get<string>("javaPath") || "java",
    args: config.get<string[]>("args", []),
    jvmArgs: config.get<string[]>("jvmArgs", []),
  };
}

async function showMissingExecutable(exe: string, setting: string): Promise<void> {
  const choice = await vscode.window.showErrorMessage(
    `Could not find '${exe}'. Install it or set '${setting}'.`,
    "Open Settings",
  );
  if (choice === "Open Settings") {
    await vscode.commands.executeCommand("workbench.action.openSettings", setting);
  }
}
