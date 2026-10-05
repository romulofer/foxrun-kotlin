import { codeTokens, isIdent, isPunct, Token } from "./lexer";
import { MODIFIER_KEYWORDS } from "./keywords";

export type KotlinSymbolKind =
  | "function"
  | "class"
  | "interface"
  | "object"
  | "typealias"
  | "enumEntry"
  | "property"
  | "variable"
  | "parameter";

export interface KotlinSymbol {
  name: string;
  kind: KotlinSymbolKind;
  /** Zero based line of the name. */
  line: number;
  /** Declared at file level (outside any braces or parentheses). */
  topLevel: boolean;
  isPrivate: boolean;
  /** Short signature, e.g. `fun greet(name: String): String`. */
  detail: string;
}

const MODIFIERS = new Set<string>(MODIFIER_KEYWORDS);
const DECLARATION_KEYWORDS = new Set(["fun", "val", "var", "class", "interface", "object", "typealias"]);

export function extractSymbols(src: string): KotlinSymbol[] {
  return new Extractor(src, codeTokens(src)).run();
}

class Extractor {
  private readonly symbols: KotlinSymbol[] = [];
  private braceDepth = 0;
  private parenDepth = 0;
  /** Kind of each open brace: a class/object/interface body or any other block. */
  private readonly braces: ("type" | "block")[] = [];
  /** Set after a type header, until its body brace (or another declaration) is seen. */
  private pendingTypeBody: number | undefined;

  constructor(
    private readonly src: string,
    private readonly tokens: Token[],
  ) {}

  run(): KotlinSymbol[] {
    const tokens = this.tokens;
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (t.kind === "punct") {
        this.trackDepth(t);
        if (t.text === "{") this.lambdaParams(i);
        continue;
      }
      if (t.kind !== "identifier" || this.isMemberReference(i)) continue;
      if (DECLARATION_KEYWORDS.has(t.text) && this.parenDepth === this.pendingTypeBody) {
        this.pendingTypeBody = undefined;
      }
      switch (t.text) {
        case "fun":
          this.fun(i);
          break;
        case "class":
        case "interface":
        case "object":
        case "typealias":
          this.typeDecl(i);
          break;
        case "val":
        case "var":
          if (this.parenDepth === 0) this.property(i);
          break;
        case "for":
          this.forLoop(i);
          break;
      }
    }
    return this.symbols;
  }

  private trackDepth(t: Token): void {
    if (t.text === "{") {
      this.braceDepth++;
      const isTypeBody = this.pendingTypeBody === this.parenDepth;
      this.braces.push(isTypeBody ? "type" : "block");
      if (isTypeBody) this.pendingTypeBody = undefined;
    } else if (t.text === "}") {
      this.braceDepth = Math.max(0, this.braceDepth - 1);
      this.braces.pop();
    }
    else if (t.text === "(") this.parenDepth++;
    else if (t.text === ")") this.parenDepth = Math.max(0, this.parenDepth - 1);
  }

  private get topLevel(): boolean {
    return this.braceDepth === 0 && this.parenDepth === 0;
  }

  /** `Foo::class`, `a.fun` and similar uses of a keyword that are not declarations. */
  private isMemberReference(i: number): boolean {
    const prev = this.tokens[i - 1];
    return isPunct(prev, ".") || (isPunct(prev, ":") && isPunct(this.tokens[i - 2], ":"));
  }

  private add(name: Token, kind: KotlinSymbolKind, declStart: number, detail: string, topLevel = this.topLevel): void {
    this.symbols.push({
      name: name.text,
      kind,
      line: name.line,
      topLevel,
      isPrivate: this.hasPrivateModifier(declStart),
      detail: detail.replace(/\s+/g, " ").trim(),
    });
  }

  private hasPrivateModifier(declIndex: number): boolean {
    for (let k = declIndex - 1; k >= 0; k--) {
      const t = this.tokens[k];
      if (t.kind !== "identifier" || !MODIFIERS.has(t.text)) return false;
      if (t.text === "private") return true;
    }
    return false;
  }

  private fun(i: number): void {
    const tokens = this.tokens;
    if (isIdent(tokens[i + 1], "interface")) return;
    let j = this.skipAngles(i + 1);
    let name: Token | undefined;
    while (j < tokens.length && !isPunct(tokens[j], "(")) {
      const t = tokens[j];
      if (isPunct(t, "{") || isPunct(t, "=") || isPunct(t, ";")) return;
      if (t.kind === "identifier") name = t;
      else if (isPunct(t, "<")) {
        j = this.skipAngles(j);
        continue;
      }
      j++;
    }
    if (!name || j >= tokens.length) return;
    const close = this.matching(j, "(", ")");
    const end = this.signatureEnd(close === -1 ? j : close);
    this.add(name, "function", i, this.src.slice(tokens[i].start, end));
    if (close !== -1) this.parameters(j, close, "parameter");
  }

  private typeDecl(i: number): void {
    const tokens = this.tokens;
    const kw = tokens[i];
    const kind = kw.text as "class" | "interface" | "object" | "typealias";
    // Anonymous and companion objects have a body but no name.
    if (kind !== "typealias") this.pendingTypeBody = this.parenDepth;
    const name = tokens[i + 1];
    if (!name || name.kind !== "identifier") return;
    this.add(name, kind, i, `${kw.text} ${name.text}`);

    let j = this.skipAngles(i + 2);
    while (j < tokens.length && tokens[j].kind === "identifier" && (MODIFIERS.has(tokens[j].text) || tokens[j].text === "constructor")) {
      j++;
    }
    if (isPunct(tokens[j], "(")) {
      const close = this.matching(j, "(", ")");
      if (close !== -1) this.parameters(j, close, "parameter");
    }

    if (this.declaredWith(i, "enum")) this.enumEntries(i);
  }

  private declaredWith(declIndex: number, modifier: string): boolean {
    for (let k = declIndex - 1; k >= 0; k--) {
      const t = this.tokens[k];
      if (t.kind !== "identifier" || !MODIFIERS.has(t.text)) return false;
      if (t.text === modifier) return true;
    }
    return false;
  }

  private enumEntries(declIndex: number): void {
    const tokens = this.tokens;
    let j = declIndex + 2;
    let parens = 0;
    while (j < tokens.length) {
      const t = tokens[j];
      if (isPunct(t, "(")) parens++;
      else if (isPunct(t, ")")) parens--;
      else if (parens === 0 && isPunct(t, "{")) break;
      j++;
    }
    j++;
    while (j < tokens.length) {
      while (isPunct(tokens[j], "@")) j += 2;
      const entry = tokens[j];
      if (!entry || entry.kind !== "identifier") return;
      this.add(entry, "enumEntry", j, entry.text, false);
      j++;
      if (isPunct(tokens[j], "(")) j = this.matching(j, "(", ")") + 1;
      if (isPunct(tokens[j], "{")) j = this.matching(j, "{", "}") + 1;
      if (j <= 0 || !isPunct(tokens[j], ",")) return;
      j++;
    }
  }

  private property(i: number): void {
    const tokens = this.tokens;
    if (isPunct(tokens[i + 1], "(")) {
      const close = this.matching(i + 1, "(", ")");
      if (close !== -1) this.destructured(i + 1, close, "variable");
      return;
    }
    let j = this.skipAngles(i + 1);
    let name: Token | undefined;
    const line = tokens[i].line;
    while (j < tokens.length && tokens[j].line === line) {
      const t = tokens[j];
      if (isPunct(t, ":") || isPunct(t, "=") || isPunct(t, ";") || isPunct(t, "{") || isIdent(t, "by")) break;
      if (t.kind === "identifier") name = t;
      else if (isPunct(t, "<")) {
        j = this.skipAngles(j);
        continue;
      }
      j++;
    }
    if (!name) return;
    const inTypeBody = this.braces.length === 0 || this.braces[this.braces.length - 1] === "type";
    this.add(name, inTypeBody ? "property" : "variable", i, this.src.slice(tokens[i].start, this.signatureEnd(i)));
  }

  private forLoop(i: number): void {
    const tokens = this.tokens;
    if (!isPunct(tokens[i + 1], "(")) return;
    const t = tokens[i + 2];
    if (isPunct(t, "(")) {
      const close = this.matching(i + 2, "(", ")");
      if (close !== -1) this.destructured(i + 2, close, "variable");
    } else if (t && t.kind === "identifier" && isIdent(tokens[i + 3], "in")) {
      this.add(t, "variable", i + 2, t.text, false);
    }
  }

  /** Lambda parameters: `{ a, b -> ...}` */
  private lambdaParams(braceIndex: number): void {
    const tokens = this.tokens;
    const names: Token[] = [];
    let j = braceIndex + 1;
    while (j < tokens.length) {
      const t = tokens[j];
      if (t.kind === "identifier") {
        if (t.text !== "_") names.push(t);
      } else if (!isPunct(t, ",")) break;
      j++;
    }
    if (names.length > 0 && isPunct(tokens[j], "-") && isPunct(tokens[j + 1], ">") && tokens[j + 1].start === tokens[j].end) {
      for (const n of names) this.add(n, "parameter", braceIndex, n.text, false);
    }
  }

  private parameters(open: number, close: number, kind: KotlinSymbolKind): void {
    const tokens = this.tokens;
    let depth = 0;
    for (let k = open + 1; k < close; k++) {
      const t = tokens[k];
      depth += this.nesting(k);
      if (depth !== 0 || t.kind !== "identifier" || !isPunct(tokens[k + 1], ":")) continue;
      // A parameter name follows `(`, `,`, a modifier or an annotation.
      const prev = tokens[k - 1];
      if (!isPunct(prev, "(") && !isPunct(prev, ",") && prev.kind !== "identifier") continue;
      let end = k + 2;
      let d = 0;
      while (end < close) {
        d += this.nesting(end);
        if (d === 0 && (isPunct(tokens[end], ",") || isPunct(tokens[end], "="))) break;
        end++;
      }
      const declKeyword = isIdent(prev, "val") || isIdent(prev, "var");
      const detailStart = declKeyword ? prev.start : t.start;
      const detail = this.src.slice(detailStart, tokens[end - 1].end);
      this.add(t, declKeyword ? "property" : kind, k, detail, false);
    }
  }

  private destructured(open: number, close: number, kind: KotlinSymbolKind): void {
    const tokens = this.tokens;
    for (let k = open + 1; k < close; k++) {
      const t = tokens[k];
      const prev = tokens[k - 1];
      if (t.kind === "identifier" && t.text !== "_" && (isPunct(prev, "(") || isPunct(prev, ","))) {
        this.add(t, kind, k, t.text, false);
      }
    }
  }

  /** +1 for an opening bracket, -1 for a closing one (ignoring the `>` of `->`), 0 otherwise. */
  private nesting(k: number): number {
    const t = this.tokens[k];
    if (t.kind !== "punct") return 0;
    if ("(<{[".includes(t.text)) return 1;
    if (t.text === ">") return isPunct(this.tokens[k - 1], "-") && this.tokens[k - 1].end === t.start ? 0 : -1;
    if (")}]".includes(t.text)) return -1;
    return 0;
  }

  /** Index after a balanced `<...>` starting at `start`, or `start` when there is none. */
  private skipAngles(start: number): number {
    if (!isPunct(this.tokens[start], "<")) return start;
    let depth = 0;
    for (let k = start; k < this.tokens.length; k++) {
      const t = this.tokens[k];
      if (isPunct(t, "<")) depth++;
      else if (isPunct(t, ">") && this.nesting(k) === -1) {
        depth--;
        if (depth === 0) return k + 1;
      } else if (isPunct(t, "{") || isPunct(t, ";")) return start;
    }
    return start;
  }

  private matching(open: number, o: string, c: string): number {
    let depth = 0;
    for (let k = open; k < this.tokens.length; k++) {
      const t = this.tokens[k];
      if (isPunct(t, o)) depth++;
      else if (isPunct(t, c)) {
        depth--;
        if (depth === 0) return k;
      }
    }
    return -1;
  }

  /** End offset of a declaration header: stops before `{`, `=`, `by` or an accessor on the same line as `from`. */
  private signatureEnd(from: number): number {
    const tokens = this.tokens;
    const start = tokens[from];
    let end = start.end;
    for (let k = from + 1; k < tokens.length; k++) {
      const t = tokens[k];
      if (t.line !== start.line || isPunct(t, "{") || isPunct(t, "=") || isPunct(t, ";") || isIdent(t, "by") || isIdent(t, "where") || isAccessor(t, tokens[k - 1])) break;
      end = t.end;
    }
    return end;
  }
}

function isAccessor(t: Token, prev: Token): boolean {
  return (isIdent(t, "get") || isIdent(t, "set")) && !isPunct(prev, ".");
}
