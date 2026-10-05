import { ALL_KEYWORDS } from "./keywords";
import { computeLineStarts, contextAt, lex, lineAt } from "./lexer";
import { SNIPPETS } from "./snippets";
import { STDLIB, StdlibEntry } from "./stdlib";
import { extractSymbols, KotlinSymbol, KotlinSymbolKind } from "./symbolExtractor";

export type CandidateKind = KotlinSymbolKind | "keyword" | "snippet" | "word";

/** Lower groups sort first. */
export enum Group {
  Document = 0,
  Workspace = 1,
  Keyword = 2,
  Snippet = 3,
  Stdlib = 4,
  Word = 5,
}

export interface CompletionCandidate {
  label: string;
  kind: CandidateKind;
  group: Group;
  detail?: string;
  documentation?: string;
  /** Snippet body in VS Code snippet syntax, when the insert text is a snippet. */
  snippet?: string;
}

/** Scope functions and common extensions offered after a `.`. */
const MEMBER_STDLIB = new Set(["let", "also", "apply", "run", "takeIf", "takeUnless"]);

/**
 * Completion candidates at `offset`, or undefined when completion should not be offered
 * (inside comments, strings or annotations).
 */
export function computeCompletions(
  text: string,
  offset: number,
  workspaceSymbols: readonly KotlinSymbol[] = [],
): CompletionCandidate[] | undefined {
  if (contextAt(text, offset) !== "code") return undefined;

  let wordStart = offset;
  while (wordStart > 0 && /[\p{L}\p{N}_]/u.test(text[wordStart - 1])) wordStart--;
  const before = text[wordStart - 1];
  if (before === "@") return undefined;

  const seen = new Set<string>();
  const out: CompletionCandidate[] = [];
  const addSymbolLike = (c: CompletionCandidate) => {
    if (seen.has(c.label)) return;
    seen.add(c.label);
    out.push(c);
  };

  if (before === "." && text[wordStart - 2] !== ".") {
    for (const entry of STDLIB) {
      if (MEMBER_STDLIB.has(entry.name)) addSymbolLike(stdlibCandidate(entry));
    }
    for (const word of documentWords(text, wordStart, offset)) {
      addSymbolLike({ label: word, kind: "word", group: Group.Word });
    }
    return out;
  }

  const cursorLine = lineAt(computeLineStarts(text), offset);
  for (const s of extractSymbols(text)) {
    // Locals only make sense once declared; top level declarations are visible everywhere.
    if (!s.topLevel && s.line > cursorLine) continue;
    if (s.line === cursorLine && wordStart !== offset && text.slice(wordStart, offset) === s.name) continue;
    addSymbolLike({ label: s.name, kind: s.kind, group: Group.Document, detail: s.detail });
  }
  for (const s of workspaceSymbols) {
    addSymbolLike({ label: s.name, kind: s.kind, group: Group.Workspace, detail: s.detail });
  }
  for (const entry of STDLIB) addSymbolLike(stdlibCandidate(entry));

  for (const keyword of ALL_KEYWORDS) {
    out.push({ label: keyword, kind: "keyword", group: Group.Keyword });
  }
  for (const snippet of SNIPPETS) {
    out.push({
      label: snippet.prefix,
      kind: "snippet",
      group: Group.Snippet,
      detail: snippet.description,
      snippet: snippet.body,
    });
  }
  return out;
}

function stdlibCandidate(entry: StdlibEntry): CompletionCandidate {
  return {
    label: entry.name,
    kind: entry.kind,
    group: Group.Stdlib,
    detail: entry.detail,
    documentation: entry.documentation,
  };
}

/** Distinct identifiers in the text, excluding the one being typed. */
function documentWords(text: string, wordStart: number, offset: number): string[] {
  const words = new Set<string>();
  for (const t of lex(text).tokens) {
    if (t.kind !== "identifier" || t.text.length < 2) continue;
    if (t.start === wordStart && t.end === offset) continue;
    words.add(t.text);
  }
  return [...words];
}
