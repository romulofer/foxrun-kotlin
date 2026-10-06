import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import { analyzeFile, facadeClassName } from "../core/mainDetector";
import { buildRunSteps, cacheKey, isScript, jarPathFor, RunSettings, RunStep, staleJars } from "../core/runCommand";
import { installHelpUrl, resolveTool, Tool } from "../core/setupCheck";
import { CommandRunner } from "../terminal/runTerminal";

export interface RunOptions {
  /** Directory for compiled jars. */
  outDir: string;
  runner: () => CommandRunner;
  /** Replaces `kotlin.run.args` for this run. */
  args?: readonly string[];
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

  const settings = { ...readSettings(document.uri), ...(options.args ? { args: options.args } : {}) };
  // Resolve to absolute paths: processes are spawned without a shell.
  const kotlinc = resolveExecutable(settings.kotlincPath, "kotlinc");
  const java = script ? settings.javaPath : resolveExecutable(settings.javaPath, "java");
  if (!kotlinc || !java) return undefined;

  fs.mkdirSync(options.outDir, { recursive: true });
  const jarKey = cacheKey(document.getText(), kotlinc);
  const jar = jarPathFor(filePath, options.outDir, jarKey);
  if (!script) removeStaleJars(filePath, options.outDir, path.basename(jar));
  const steps = buildRunSteps(
    {
      filePath,
      mainClass: facadeClassName(filePath, info),
      outDir: options.outDir,
      jarKey,
      skipCompile: settings.useCache && !script && fs.existsSync(jar),
    },
    { ...settings, kotlincPath: kotlinc, javaPath: java },
  );
  const clear = vscode.workspace.getConfiguration("kotlin.run", document.uri).get<boolean>("clearTerminal", true);
  options.runner().run(steps, path.dirname(filePath), filePath, clear);
  return steps;
}

function removeStaleJars(filePath: string, outDir: string, keep: string): void {
  try {
    for (const name of staleJars(filePath, fs.readdirSync(outDir), keep)) fs.rmSync(path.join(outDir, name), { force: true });
  } catch {
    // The cache is an optimisation; failing to prune it must not block a run.
  }
}

/** Deletes every cached jar. Returns how many files were removed. */
export function clearBuildCache(outDir: string): number {
  let removed = 0;
  try {
    for (const name of fs.readdirSync(outDir)) {
      if (!name.endsWith(".jar")) continue;
      fs.rmSync(path.join(outDir, name), { force: true });
      removed++;
    }
  } catch {
    // Nothing to clear when the directory does not exist yet.
  }
  return removed;
}

const SETTING: Record<Tool, string> = { kotlinc: "kotlin.run.kotlincPath", java: "kotlin.run.javaPath" };

/** Resolves a configured command, checking well known install locations for bare tool names. */
export function resolveExecutable(command: string, tool: Tool): string | undefined {
  const resolved = resolveTool(command, process.env, os.homedir(), process.platform);
  if (!resolved) void showMissingExecutable(command, tool);
  return resolved;
}

async function resolveDocument(target: vscode.Uri | undefined): Promise<vscode.TextDocument | undefined> {
  const uri = target instanceof vscode.Uri ? target : vscode.window.activeTextEditor?.document.uri;
  if (!uri) return undefined;
  const document = await vscode.workspace.openTextDocument(uri);
  return document.languageId === "kotlin" ? document : undefined;
}

function readSettings(uri: vscode.Uri): RunSettings & { useCache: boolean } {
  const config = vscode.workspace.getConfiguration("kotlin.run", uri);
  return {
    kotlincPath: config.get<string>("kotlincPath") || "kotlinc",
    javaPath: config.get<string>("javaPath") || "java",
    args: config.get<string[]>("args", []),
    jvmArgs: config.get<string[]>("jvmArgs", []),
    env: config.get<Record<string, string>>("env", {}),
    useCache: config.get<boolean>("useCache", true),
  };
}

async function showMissingExecutable(exe: string, tool: Tool): Promise<void> {
  const setting = SETTING[tool];
  const choice = await vscode.window.showErrorMessage(
    `Could not find '${exe}'. Install ${tool === "kotlinc" ? "the Kotlin compiler" : "a JDK"} or set '${setting}'.`,
    "Open Settings",
    "Install Help",
  );
  if (choice === "Open Settings") {
    await vscode.commands.executeCommand("workbench.action.openSettings", setting);
  } else if (choice === "Install Help") {
    await vscode.env.openExternal(vscode.Uri.parse(installHelpUrl(tool)));
  }
}
