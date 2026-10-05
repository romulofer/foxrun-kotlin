import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import { findExecutable } from "../core/executable";
import { analyzeFile, facadeClassName } from "../core/mainDetector";
import { buildRunSteps, isScript, RunSettings, RunStep } from "../core/runCommand";
import { CommandRunner } from "../terminal/runTerminal";

export interface RunOptions {
  /** Directory for compiled jars. */
  outDir: string;
  runner: () => CommandRunner;
}

/**
 * Saves and runs a Kotlin file. Returns the steps that were sent to the runner,
 * or undefined when the run was aborted (an error message has been shown).
 */
export async function runKotlinFile(target: vscode.Uri | undefined, options: RunOptions): Promise<RunStep[] | undefined> {
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
  // Resolve to absolute paths: processes are spawned without a shell.
  const kotlinc = resolveExecutable(settings.kotlincPath, "kotlin.run.kotlincPath");
  const java = script ? settings.javaPath : resolveExecutable(settings.javaPath, "kotlin.run.javaPath");
  if (!kotlinc || !java) return undefined;

  fs.mkdirSync(options.outDir, { recursive: true });
  const steps = buildRunSteps(
    { filePath, mainClass: facadeClassName(filePath, info), outDir: options.outDir },
    { ...settings, kotlincPath: kotlinc, javaPath: java },
  );
  const clear = vscode.workspace.getConfiguration("kotlin.run", document.uri).get<boolean>("clearTerminal", true);
  options.runner().run(steps, path.dirname(filePath), filePath, clear);
  return steps;
}

function resolveExecutable(command: string, setting: string): string | undefined {
  const resolved = findExecutable(command, process.env, process.platform);
  if (!resolved) void showMissingExecutable(command, setting);
  return resolved;
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
