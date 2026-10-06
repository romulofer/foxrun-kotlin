import * as path from "node:path";
import { findExecutable, LookupEnv } from "./executable";

export type Tool = "kotlinc" | "java";

export interface SetupEnv extends LookupEnv {
  KOTLIN_HOME?: string;
  JAVA_HOME?: string;
}

/** Directories worth checking when a tool is not on PATH (version managers, Homebrew, env homes). */
export function fallbackDirs(tool: Tool, env: SetupEnv, home: string, platform: NodeJS.Platform): string[] {
  const dirs: string[] = [];
  const envHome = tool === "kotlinc" ? env.KOTLIN_HOME : env.JAVA_HOME;
  if (envHome) dirs.push((platform === "win32" ? path.win32 : path.posix).join(envHome, "bin"));
  const candidate = tool === "kotlinc" ? "kotlin" : "java";
  dirs.push(path.join(home, ".sdkman", "candidates", candidate, "current", "bin"));
  if (platform === "darwin") {
    dirs.push("/opt/homebrew/bin", "/usr/local/bin");
    dirs.push(tool === "kotlinc" ? "/opt/homebrew/opt/kotlin/bin" : "/opt/homebrew/opt/openjdk/bin");
  } else if (platform === "linux") {
    dirs.push("/snap/bin", "/home/linuxbrew/.linuxbrew/bin");
  } else if (platform === "win32") {
    dirs.push(path.win32.join(home, "scoop", "shims"));
  }
  return dirs;
}

/**
 * Resolves a configured command. Bare tool names fall back to well known install locations
 * when they are not on PATH; explicit paths and other commands are only checked as given.
 */
export function resolveTool(command: string, env: SetupEnv, home: string, platform: NodeJS.Platform): string | undefined {
  const found = findExecutable(command, env, platform);
  if (found || (command !== "kotlinc" && command !== "java")) return found;
  const dirs = fallbackDirs(command, env, home, platform);
  return findExecutable(command, { PATH: dirs.join(platform === "win32" ? ";" : ":"), PATHEXT: env.PATHEXT }, platform);
}

/** Short version label from `kotlinc -version` or `java -version` output. */
export function parseVersion(output: string): string {
  const kotlin = /(kotlinc-\w+)\s+(\d[\w.+-]*)/.exec(output);
  if (kotlin) return `${kotlin[1]} ${kotlin[2]}`;
  const java = /^(\w[\w ]*?) version "([^"]+)"/m.exec(output);
  if (java) return `${java[1].replace(/ version$/, "")} ${java[2]}`;
  return "unknown version";
}

export function installHelpUrl(tool: Tool): string {
  return tool === "kotlinc" ? "https://kotlinlang.org/docs/command-line.html" : "https://adoptium.net/installation/";
}
