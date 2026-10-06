import * as vscode from "vscode";
import { extractSymbols, KotlinSymbol } from "../core/symbolExtractor";

export interface IndexedSymbol extends KotlinSymbol {
  uri: vscode.Uri;
}

const KOTLIN_GLOB = "**/*.{kt,kts}";
const EXCLUDE_GLOB = "**/{build,out,node_modules,.gradle,.git}/**";
const MAX_FILES = 5000;

/** Top level and member (non private) declarations of every Kotlin file in the workspace. */
export class WorkspaceIndex implements vscode.Disposable {
  private readonly files = new Map<string, IndexedSymbol[]>();
  private readonly disposables: vscode.Disposable[] = [];
  private ready: Promise<void> | undefined;

  start(): Promise<void> {
    if (this.ready) return this.ready;
    const watcher = vscode.workspace.createFileSystemWatcher(KOTLIN_GLOB);
    this.disposables.push(
      watcher,
      watcher.onDidCreate((uri) => this.indexFile(uri)),
      watcher.onDidChange((uri) => this.indexFile(uri)),
      watcher.onDidDelete((uri) => this.files.delete(uri.toString())),
      vscode.workspace.onDidSaveTextDocument((doc) => {
        if (doc.languageId === "kotlin") this.indexText(doc.uri, doc.getText());
      }),
    );
    this.ready = (async () => {
      const uris = await vscode.workspace.findFiles(KOTLIN_GLOB, EXCLUDE_GLOB, MAX_FILES);
      await Promise.all(uris.map((uri) => this.indexFile(uri)));
    })();
    return this.ready;
  }

  /** Top level symbols from all indexed files except `exclude`. */
  symbols(exclude?: vscode.Uri): IndexedSymbol[] {
    return this.collect(exclude, (s) => s.topLevel);
  }

  /** Members of classes, interfaces and objects from all indexed files except `exclude`. */
  members(exclude?: vscode.Uri): IndexedSymbol[] {
    return this.collect(exclude, (s) => s.container !== undefined);
  }

  private collect(exclude: vscode.Uri | undefined, keep: (s: IndexedSymbol) => boolean): IndexedSymbol[] {
    const skip = exclude?.toString();
    const result: IndexedSymbol[] = [];
    for (const [key, symbols] of this.files) {
      if (key !== skip) result.push(...symbols.filter(keep));
    }
    return result;
  }

  private async indexFile(uri: vscode.Uri): Promise<void> {
    try {
      const bytes = await vscode.workspace.fs.readFile(uri);
      this.indexText(uri, new TextDecoder().decode(bytes));
    } catch {
      this.files.delete(uri.toString());
    }
  }

  private indexText(uri: vscode.Uri, text: string): void {
    const symbols = extractSymbols(text)
      .filter((s) => (s.topLevel || s.container !== undefined) && !s.isPrivate)
      .map((s) => ({ ...s, uri }));
    this.files.set(uri.toString(), symbols);
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
    this.disposables.length = 0;
    this.files.clear();
    this.ready = undefined;
  }
}
