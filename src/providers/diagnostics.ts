import * as path from "node:path";
import * as vscode from "vscode";
import { CompilerDiagnostic, findLocationLinks, parseKotlincOutput } from "../core/kotlincDiagnostics";
import { RunHooks, TERMINAL_NAME } from "../terminal/runTerminal";

const SEVERITY: Record<CompilerDiagnostic["severity"], vscode.DiagnosticSeverity> = {
  error: vscode.DiagnosticSeverity.Error,
  warning: vscode.DiagnosticSeverity.Warning,
  info: vscode.DiagnosticSeverity.Information,
};

/** Publishes `kotlinc` problems to the Problems panel, replacing the previous run's. */
export class CompilerDiagnostics implements RunHooks, vscode.Disposable {
  private readonly collection = vscode.languages.createDiagnosticCollection("kotlinc");
  /** Working directory of the latest run, used to resolve relative paths in compiler output. */
  lastCwd: string | undefined;

  started(_fileName: string, cwd: string): void {
    this.lastCwd = cwd;
    // Problems come from compiling, so a cached run keeps none and a new compile replaces them all.
    this.collection.clear();
  }

  compiled(_fileName: string, cwd: string, output: string): void {
    if (!vscode.workspace.getConfiguration("kotlin.run").get<boolean>("showDiagnostics", true)) return;
    const byFile = new Map<string, vscode.Diagnostic[]>();
    for (const d of parseKotlincOutput(output)) {
      const file = path.resolve(cwd, d.file);
      const diagnostic = new vscode.Diagnostic(this.range(file, d), d.message, SEVERITY[d.severity]);
      diagnostic.source = "kotlinc";
      byFile.set(file, [...(byFile.get(file) ?? []), diagnostic]);
    }
    this.collection.clear();
    for (const [file, list] of byFile) this.collection.set(vscode.Uri.file(file), list);
  }

  dispose(): void {
    this.collection.dispose();
  }

  private range(file: string, d: CompilerDiagnostic): vscode.Range {
    const line = Math.max(d.line - 1, 0);
    const column = Math.max(d.column - 1, 0);
    const document = vscode.workspace.textDocuments.find((t) => t.uri.fsPath === file);
    if (document && line < document.lineCount) {
      const position = new vscode.Position(line, Math.min(column, document.lineAt(line).text.length));
      return document.getWordRangeAtPosition(position) ?? new vscode.Range(position, document.lineAt(line).range.end);
    }
    return new vscode.Range(line, column, line, column + 1);
  }
}

/** Makes `file.kt:line:col` references in the Kotlin Run terminal clickable. */
interface SourceLink extends vscode.TerminalLink {
  file: string;
  line: number;
  column: number;
}

export class CompilerOutputLinks implements vscode.TerminalLinkProvider {
  constructor(private readonly cwd: () => string | undefined) {}

  provideTerminalLinks(context: vscode.TerminalLinkContext): SourceLink[] {
    if (context.terminal.name !== TERMINAL_NAME) return [];
    return findLocationLinks(context.line).map((l): SourceLink => ({
      startIndex: l.startIndex,
      length: l.length,
      tooltip: "Open in editor",
      file: l.file,
      line: l.line,
      column: l.column,
    }));
  }

  async handleTerminalLink(terminalLink: vscode.TerminalLink): Promise<void> {
    const link = terminalLink as SourceLink;
    const file = path.resolve(this.cwd() ?? "", link.file);
    const position = new vscode.Position(Math.max(link.line - 1, 0), Math.max(link.column - 1, 0));
    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(file));
    await vscode.window.showTextDocument(document, { selection: new vscode.Range(position, position) });
  }
}
