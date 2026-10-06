export interface ParsedArgs {
  args: string[];
  /** Set when the line cannot be split, for example an unterminated quote. */
  error?: string;
}

/** Splits a command line the way a POSIX shell would, without expanding anything. */
export function parseArgs(line: string): ParsedArgs {
  const args: string[] = [];
  let current = "";
  let inToken = false;
  let quote: "'" | "\"" | undefined;

  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote === "'") {
      if (c === "'") quote = undefined;
      else current += c;
    } else if (quote === "\"") {
      if (c === "\"") quote = undefined;
      else if (c === "\\" && (line[i + 1] === "\"" || line[i + 1] === "\\")) current += line[++i];
      else current += c;
    } else if (c === "'" || c === "\"") {
      quote = c;
      inToken = true;
    } else if (c === "\\" && i + 1 < line.length) {
      current += line[++i];
      inToken = true;
    } else if (/\s/.test(c)) {
      if (inToken) {
        args.push(current);
        current = "";
        inToken = false;
      }
    } else {
      current += c;
      inToken = true;
    }
  }
  if (quote) return { args, error: `Unterminated ${quote} quote` };
  if (inToken) args.push(current);
  return { args };
}

/** Joins arguments into a line that `parseArgs` splits back into the same list. */
export function formatArgs(args: readonly string[]): string {
  return args
    .map((a) => (a !== "" && /^[\w@%+=:,./-]+$/.test(a) ? a : `"${a.replace(/(["\\])/g, "\\$1")}"`))
    .join(" ");
}
