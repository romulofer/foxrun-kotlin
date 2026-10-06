import { createHash } from "node:crypto";
import * as path from "node:path";

export interface RunSettings {
  kotlincPath: string;
  javaPath: string;
  args: readonly string[];
  jvmArgs: readonly string[];
  /** Extra environment variables for the process that runs the program. */
  env?: Readonly<Record<string, string>>;
}

export interface RunTarget {
  /** Absolute path to the .kt or .kts file. */
  filePath: string;
  /** Fully qualified JVM class that holds `main`. Ignored for scripts. */
  mainClass: string;
  /** Directory for compiled jars. */
  outDir: string;
  /** Content based key (see `cacheKey`) that makes the jar name unique per source version. */
  jarKey?: string;
  /** The jar for `jarKey` already exists, so compiling can be skipped. */
  skipCompile?: boolean;
}

export interface RunStep {
  kind: "compile" | "run";
  command: string;
  args: string[];
  /** Environment variables merged over the current environment. */
  env?: Record<string, string>;
  /** Status line printed before the step starts. */
  note?: string;
}

export function isScript(filePath: string): boolean {
  return filePath.toLowerCase().endsWith(".kts");
}

/** Short key for one version of a source built with one compiler. */
export function cacheKey(source: string, kotlincPath: string): string {
  return createHash("sha256").update(source).update("\0").update(kotlincPath).digest("hex").slice(0, 8);
}

function jarPrefix(filePath: string): string {
  const base = path.basename(filePath).replace(/\.kts?$/i, "").replace(/[^\w.-]/g, "_");
  const hash = createHash("sha256").update(filePath).digest("hex").slice(0, 8);
  return `${base}-${hash}`;
}

/** Jar path for a source file. Same base name in different folders gives different jars. */
export function jarPathFor(filePath: string, outDir: string, key?: string): string {
  return path.join(outDir, `${jarPrefix(filePath)}${key ? `-${key}` : ""}.jar`);
}

/** Names (not paths) of jars in `files` that were built from older versions of `filePath`. */
export function staleJars(filePath: string, files: readonly string[], keep: string): string[] {
  const prefix = jarPrefix(filePath);
  return files.filter((f) => f !== keep && f.startsWith(`${prefix}-`) && /^-[0-9a-f]{8}\.jar$/.test(f.slice(prefix.length)));
}

function withEnv(step: RunStep, settings: RunSettings): RunStep {
  return settings.env && Object.keys(settings.env).length > 0 ? { ...step, env: { ...settings.env } } : step;
}

/** Processes to execute, in order, to compile (when needed) and run the target. */
export function buildRunSteps(target: RunTarget, settings: RunSettings): RunStep[] {
  if (isScript(target.filePath)) {
    return [withEnv({ kind: "run", command: settings.kotlincPath, args: ["-script", target.filePath, ...settings.args] }, settings)];
  }
  const jar = jarPathFor(target.filePath, target.outDir, target.jarKey);
  const run = withEnv(
    { kind: "run", command: settings.javaPath, args: [...settings.jvmArgs, "-cp", jar, target.mainClass, ...settings.args] },
    settings,
  );
  if (target.skipCompile) return [{ ...run, note: "Using cached build" }];
  return [
    { kind: "compile", command: settings.kotlincPath, args: [target.filePath, "-include-runtime", "-d", jar] },
    run,
  ];
}

/** Quotes an argument for cmd.exe, which Windows needs to launch .bat and .cmd files. */
export function quoteForCmd(arg: string): string {
  return /^[\w@%+=:,./\\-]+$/.test(arg) ? arg : `"${arg.replace(/"/g, "\"\"")}"`;
}
