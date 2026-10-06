import { execFile } from "node:child_process";
import * as vscode from "vscode";
import { parseVersion, Tool } from "../core/setupCheck";
import { resolveExecutable } from "./run";

function versionOf(executable: string): Promise<string> {
  return new Promise((resolve) => {
    // kotlinc.bat on Windows needs a shell; both tools print their version on stderr.
    execFile(executable, ["-version"], { timeout: 20000, shell: /\.(bat|cmd)$/i.test(executable) }, (error, stdout, stderr) => {
      resolve(error && !stdout && !stderr ? "failed to run" : parseVersion(`${stderr}\n${stdout}`));
    });
  });
}

/** Reports where kotlinc and java were found and which versions they are. */
export async function checkSetup(): Promise<string[]> {
  const config = vscode.workspace.getConfiguration("kotlin.run");
  const wanted: [Tool, string][] = [
    ["kotlinc", config.get<string>("kotlincPath") || "kotlinc"],
    ["java", config.get<string>("javaPath") || "java"],
  ];
  const lines: string[] = [];
  let missing = false;
  for (const [tool, command] of wanted) {
    // Resolving shows its own error with Open Settings / Install Help when missing.
    const found = resolveExecutable(command, tool);
    if (!found) {
      missing = true;
      lines.push(`${tool}: not found ('${command}')`);
    } else {
      lines.push(`${tool}: ${await versionOf(found)} at ${found}`);
    }
  }
  if (!missing) void vscode.window.showInformationMessage(`Foxrun for Kotlin is ready. ${lines.join(" | ")}`);
  return lines;
}
