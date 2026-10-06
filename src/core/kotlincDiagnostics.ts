export type DiagnosticSeverity = "error" | "warning" | "info";

export interface CompilerDiagnostic {
  file: string;
  /** 1 based. */
  line: number;
  /** 1 based. */
  column: number;
  severity: DiagnosticSeverity;
  message: string;
}

export interface LocationLink {
  startIndex: number;
  length: number;
  file: string;
  line: number;
  column: number;
}

const DIAGNOSTIC = /^(.+?):(\d+)(?::(\d+))?: (error|warning|info|exception): (.*)$/;
// A source path (it must end in .kt or .kts) followed by :line and an optional :column.
const LOCATION = /((?:[A-Za-z]:[\\/]|[\\/.~])?[^\s:()"'<>|]+\.kts?):(\d+)(?::(\d+))?/g;

/** Parses `kotlinc` output into diagnostics. Source excerpts, caret lines and status lines are ignored. */
export function parseKotlincOutput(output: string): CompilerDiagnostic[] {
  const found: CompilerDiagnostic[] = [];
  const seen = new Set<string>();
  for (const raw of output.split("\n")) {
    const m = DIAGNOSTIC.exec(raw.replace(/\r$/, ""));
    if (!m) continue;
    const diagnostic: CompilerDiagnostic = {
      file: m[1],
      line: Number(m[2]),
      column: m[3] ? Number(m[3]) : 1,
      severity: m[4] === "exception" ? "error" : (m[4] as DiagnosticSeverity),
      message: m[5],
    };
    const key = `${diagnostic.file}|${diagnostic.line}|${diagnostic.column}|${diagnostic.severity}|${diagnostic.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    found.push(diagnostic);
  }
  return found;
}

/** Finds `path.kt:line[:col]` references in one line of terminal output. */
export function findLocationLinks(line: string): LocationLink[] {
  return [...line.matchAll(LOCATION)].map((m) => ({
    startIndex: m.index ?? 0,
    length: m[0].length,
    file: m[1],
    line: Number(m[2]),
    column: m[3] ? Number(m[3]) : 1,
  }));
}
