import * as vscode from "vscode";
import { CandidateKind, CompletionCandidate, computeCompletions } from "../core/completion";
import { WorkspaceIndex } from "./workspaceIndex";

const KIND: Record<CandidateKind, vscode.CompletionItemKind> = {
  function: vscode.CompletionItemKind.Function,
  class: vscode.CompletionItemKind.Class,
  interface: vscode.CompletionItemKind.Interface,
  object: vscode.CompletionItemKind.Module,
  typealias: vscode.CompletionItemKind.TypeParameter,
  enumEntry: vscode.CompletionItemKind.EnumMember,
  property: vscode.CompletionItemKind.Property,
  variable: vscode.CompletionItemKind.Variable,
  parameter: vscode.CompletionItemKind.Variable,
  keyword: vscode.CompletionItemKind.Keyword,
  snippet: vscode.CompletionItemKind.Snippet,
  word: vscode.CompletionItemKind.Text,
};

export class KotlinCompletionProvider implements vscode.CompletionItemProvider {
  constructor(private readonly index: WorkspaceIndex | undefined) {}

  provideCompletionItems(document: vscode.TextDocument, position: vscode.Position): vscode.CompletionItem[] | undefined {
    const useIndex = vscode.workspace.getConfiguration("kotlin.completion", document.uri).get<boolean>("workspaceIndex", true);
    const workspaceSymbols = useIndex && this.index ? this.index.symbols(document.uri) : [];
    const candidates = computeCompletions(document.getText(), document.offsetAt(position), workspaceSymbols);
    return candidates?.map(toItem);
  }
}

function toItem(c: CompletionCandidate): vscode.CompletionItem {
  const item = new vscode.CompletionItem(c.label, KIND[c.kind]);
  item.sortText = `${c.group}_${c.label}`;
  if (c.detail) item.detail = c.detail;
  if (c.documentation) item.documentation = new vscode.MarkdownString(c.documentation);
  if (c.snippet) {
    item.insertText = new vscode.SnippetString(c.snippet);
    item.documentation = new vscode.MarkdownString().appendCodeblock(c.snippet.replace(/\$\{\d+:?([^}]*)\}|\$\d+/g, "$1"), "kotlin");
  }
  return item;
}
