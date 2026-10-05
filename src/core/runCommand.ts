import { createHash } from "node:crypto";
import * as path from "node:path";

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

export interface RunStep {
  kind: "compile" | "run";
  command: string;
  args: string[];
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

/** Processes to execute, in order, to compile (when needed) and run the target. */
export function buildRunSteps(target: RunTarget, settings: RunSettings): RunStep[] {
  if (isScript(target.filePath)) {
    return [{ kind: "run", command: settings.kotlincPath, args: ["-script", target.filePath, ...settings.args] }];
  }
  const jar = jarPathFor(target.filePath, target.outDir);
  return [
    { kind: "compile", command: settings.kotlincPath, args: [target.filePath, "-include-runtime", "-d", jar] },
    { kind: "run", command: settings.javaPath, args: [...settings.jvmArgs, "-cp", jar, target.mainClass, ...settings.args] },
  ];
}

/** Quotes an argument for cmd.exe, which Windows needs to launch .bat and .cmd files. */
export function quoteForCmd(arg: string): string {
  return /^[\w@%+=:,./\\-]+$/.test(arg) ? arg : `"${arg.replace(/"/g, "\"\"")}"`;
}
