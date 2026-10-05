import * as fs from "node:fs";
import * as path from "node:path";

export interface LookupEnv {
  PATH?: string;
  Path?: string;
  PATHEXT?: string;
}

/**
 * Resolves a command to an executable file, the way a shell would.
 * Absolute or relative paths are checked directly; bare names are searched on PATH.
 * Returns undefined when nothing executable is found.
 */
export function findExecutable(command: string, env: LookupEnv, platform: NodeJS.Platform): string | undefined {
  const isWindows = platform === "win32";
  const p = isWindows ? path.win32 : path.posix;
  const extensions = isWindows ? ["", ...(env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD").split(";").filter(Boolean)] : [""];
  const candidates = (base: string) => extensions.map((ext) => base + ext);

  if (command.includes("/") || (isWindows && command.includes("\\"))) {
    return candidates(command).find((c) => isExecutableFile(c, isWindows));
  }

  const dirs = (env.PATH ?? env.Path ?? "").split(isWindows ? ";" : ":").filter(Boolean);
  for (const dir of dirs) {
    const found = candidates(p.join(dir, command)).find((c) => isExecutableFile(c, isWindows));
    if (found) return found;
  }
  return undefined;
}

function isExecutableFile(file: string, isWindows: boolean): boolean {
  try {
    if (!fs.statSync(file).isFile()) return false;
    if (!isWindows) fs.accessSync(file, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
