import { createHash } from "node:crypto";
import * as path from "node:path";

export type ShellKind = "posix" | "powershell" | "cmd";

export interface RunSettings {
  kotlincPath: string;
  javaPath: string;
  args: readonly string[];
  jvmArgs: readonly string[];
}

export interface RunTarget {
  /** Absolute path to the .kt or .kts file. */
  filePath: string;
  /** Fully qualified JVM class that holds `main`. Ignored for scripts. */
  mainClass: string;
  /** Directory for compiled jars. */
  outDir: string;
}

export function isScript(filePath: string): boolean {
  return filePath.toLowerCase().endsWith(".kts");
}

/** Jar path for a source file. Same base name in different folders gives different jars. */
export function jarPathFor(filePath: string, outDir: string): string {
  const base = path.basename(filePath).replace(/\.kts?$/i, "").replace(/[^\w.-]/g, "_");
  const hash = createHash("sha256").update(filePath).digest("hex").slice(0, 8);
  return path.join(outDir, `${base}-${hash}.jar`);
}

export function shellKindFor(shellPath: string | undefined, platform: NodeJS.Platform): ShellKind {
  const shell = (shellPath ?? "").toLowerCase();
  if (/(^|[\\/])(pwsh|powershell)(\.exe)?$/.test(shell)) return "powershell";
  if (/(^|[\\/])cmd(\.exe)?$/.test(shell)) return "cmd";
  if (shell === "" && platform === "win32") return "powershell";
  return "posix";
}

export function quote(arg: string, shell: ShellKind): string {
  switch (shell) {
    case "posix":
      return /^[\w@%+=:,./-]+$/.test(arg) ? arg : `'${arg.replace(/'/g, "'\\''")}'`;
    case "powershell":
      return /^[\w@%+=:,./\\-]+$/.test(arg) ? arg : `'${arg.replace(/'/g, "''")}'`;
    case "cmd":
      return /^[\w@%+=:,./\\-]+$/.test(arg) ? arg : `"${arg.replace(/"/g, "\"\"")}"`;
  }
}

function commandLine(argv: readonly string[], shell: ShellKind): string {
  const line = argv.map((a) => quote(a, shell)).join(" ");
  // PowerShell needs the call operator to run a quoted executable path.
  return shell === "powershell" && line.startsWith("'") ? `& ${line}` : line;
}

function andThen(first: string, second: string, shell: ShellKind): string {
  return shell === "powershell" ? `${first}; if ($?) { ${second} }` : `${first} && ${second}`;
}

/** Shell command line that compiles (when needed) and runs the target. */
export function buildRunCommand(target: RunTarget, settings: RunSettings, shell: ShellKind): string {
  if (isScript(target.filePath)) {
    return commandLine([settings.kotlincPath, "-script", target.filePath, ...settings.args], shell);
  }
  const jar = jarPathFor(target.filePath, target.outDir);
  const compile = commandLine([settings.kotlincPath, target.filePath, "-include-runtime", "-d", jar], shell);
  const run = commandLine([settings.javaPath, ...settings.jvmArgs, "-cp", jar, target.mainClass, ...settings.args], shell);
  return andThen(compile, run, shell);
}
