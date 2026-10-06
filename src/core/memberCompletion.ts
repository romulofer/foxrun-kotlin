import { codeTokens, isIdent, isPunct, Token } from "./lexer";
import { EXTENDS, FUNCTION_RETURNS, MEMBERS, TYPE_ALIASES } from "./stdlibMembers";
import { KotlinSymbol } from "./symbolExtractor";

export interface MemberCandidate {
  label: string;
  kind: "function" | "property";
  /** Signature, e.g. `fun substring(startIndex: Int): String`. */
  detail: string;
  /** Snippet body for functions (`name()`, `name($0)` or `name { $0 }`). */
  snippet?: string;
}

/**
 * Members available after the `.` at `dotOffset`, or undefined when the receiver's type
 * cannot be determined. `symbols` are declarations from the document and the workspace.
 */
export function memberCompletions(text: string, dotOffset: number, symbols: readonly KotlinSymbol[]): MemberCandidate[] | undefined {
  const tokens = codeTokens(text);
  const dot = tokens.findIndex((t) => t.start === dotOffset && isPunct(t, "."));
  if (dot <= 0) return undefined;
  const type = new TypeResolver(tokens, symbols).typeBefore(dot);
  return type ? membersOf(type, symbols) : undefined;
}

/** Signatures of all members of `type`: standard library tables plus declarations that belong to it. */
function membersOf(type: string, symbols: readonly KotlinSymbol[]): MemberCandidate[] {
  const byName = new Map<string, MemberCandidate>();
  const add = (c: MemberCandidate) => {
    if (!byName.has(c.label)) byName.set(c.label, c);
  };
  for (const s of symbols) {
    if (s.container !== type || s.isPrivate || (s.kind !== "function" && s.kind !== "property")) continue;
    add(candidate(s.name, s.kind === "function" ? "function" : "property", s.detail));
  }
  for (const t of typeChain(type)) {
    for (const sig of MEMBERS[t] ?? []) {
      const parsed = parseSignature(sig);
      if (parsed) add(candidate(parsed.name, parsed.kind, sig));
    }
  }
  for (const sig of MEMBERS.Any) {
    const parsed = parseSignature(sig);
    if (parsed) add(candidate(parsed.name, parsed.kind, sig));
  }
  return [...byName.values()];
}

function typeChain(type: string): string[] {
  const chain: string[] = [];
  const visit = (t: string) => {
    if (chain.includes(t)) return;
    chain.push(t);
    for (const parent of EXTENDS[t] ?? []) visit(parent);
  };
  visit(type);
  return chain;
}

function candidate(name: string, kind: "function" | "property", detail: string): MemberCandidate {
  if (kind === "property") return { label: name, kind, detail };
  const params = /\(([^]*)\)/.exec(detail)?.[1].trim() ?? "";
  const hasParams = params.length > 0;
  const onlyLambda = hasParams && !params.includes(",") && params.includes("->");
  // The last parameter of a call is a lambda when the signature says so: prefer trailing lambda syntax.
  const snippet = !hasParams ? `${name}()` : onlyLambda ? `${name} { $0 }` : `${name}($0)`;
  return { label: name, kind, detail, snippet };
}

function parseSignature(sig: string): { name: string; kind: "function" | "property" } | undefined {
  const m = /^(fun|val|var)\s+(?:[\w<>?.]+\.)?(\w+)/.exec(sig);
  return m ? { name: m[2], kind: m[1] === "fun" ? "function" : "property" } : undefined;
}

/** Type name at the end of a signature or declaration (`: String`, `): List<R>`), without generics or `?`. */
function returnTypeOf(detail: string): string | undefined {
  const fn = /\)\s*:\s*([^)]*)$/.exec(detail);
  const raw = fn ? fn[1] : /^(?:val|var)\s[^:=]*:\s*([^=]+)$/.exec(detail)?.[1];
  return raw ? baseTypeName(raw) : undefined;
}

/** `kotlin.collections.List<Int>?` is `List`. */
function baseTypeName(raw: string): string | undefined {
  const m = /^\s*([A-Za-z_][\w]*(?:\.[A-Za-z_]\w*)*)\s*(?:<[^]*>)?\s*\??\s*$/.exec(raw);
  if (!m) return undefined;
  const name = m[1].split(".").pop()!;
  return TYPE_ALIASES[name] ?? name;
}

function numberType(text: string): string {
  if (/^0[xXbB]/.test(text)) return /[lL]$/.test(text) ? "Long" : "Int";
  if (/[fF]$/.test(text)) return "Float";
  if (/[.eE]/.test(text)) return "Double";
  return /[lL]$/.test(text) ? "Long" : "Int";
}

class TypeResolver {
  constructor(
    private readonly tokens: Token[],
    private readonly symbols: readonly KotlinSymbol[],
  ) {}

  /** Type of the expression that ends right before the dot at `dot`. */
  typeBefore(dot: number): string | undefined {
    let end = dot - 1;
    // `a?.` and `a!!.`
    if (isPunct(this.tokens[end], "?")) end--;
    else if (isPunct(this.tokens[end], "!") && isPunct(this.tokens[end - 1], "!")) end -= 2;
    return end >= 0 ? this.typeEndingAt(end) : undefined;
  }

  private typeEndingAt(end: number): string | undefined {
    const t = this.tokens[end];
    if (!t) return undefined;
    if (t.kind === "string") return "String";
    if (t.kind === "char") return "Char";
    if (t.kind === "number") return numberType(t.text);
    if (t.kind === "identifier") return this.identifierType(end);
    if (isPunct(t, ")")) return this.callType(end);
    return undefined;
  }

  private identifierType(i: number): string | undefined {
    const t = this.tokens[i];
    if (t.text === "true" || t.text === "false") return "Boolean";
    if (t.text === "this") return this.enclosingType(i);
    const before = this.tokens[i - 1];
    if (isPunct(before, ".")) {
      const receiver = this.typeBefore(i - 1);
      return receiver ? this.memberType(receiver, t.text) : undefined;
    }
    return this.variableType(t.text, i);
  }

  /** `name(...)`, `a.name(...)` or `name<T>(...)` where `close` is the index of `)`. */
  private callType(close: number): string | undefined {
    const open = this.matchingBackwards(close, "(", ")");
    if (open <= 0) return undefined;
    let nameIndex = open - 1;
    if (isPunct(this.tokens[nameIndex], ">")) {
      const lt = this.matchingBackwards(nameIndex, "<", ">");
      if (lt <= 0) return undefined;
      nameIndex = lt - 1;
    }
    const name = this.tokens[nameIndex];
    if (!name || name.kind !== "identifier") return undefined;
    if (isPunct(this.tokens[nameIndex - 1], ".")) {
      const receiver = this.typeBefore(nameIndex - 1);
      return receiver ? this.memberType(receiver, name.text) : undefined;
    }
    return this.functionResult(name.text);
  }

  private functionResult(name: string): string | undefined {
    const known = FUNCTION_RETURNS[name];
    if (known) return known;
    for (const s of this.symbols) {
      if (s.kind === "function" && s.name === name && !s.container) {
        const declared = returnTypeOf(s.detail);
        if (declared) return declared;
      }
    }
    // A capitalized call is a constructor.
    return /^[A-Z]/.test(name) ? (TYPE_ALIASES[name] ?? name) : undefined;
  }

  /** Type of property or method `name` on `receiver`. */
  private memberType(receiver: string, name: string): string | undefined {
    for (const s of this.symbols) {
      if (s.container === receiver && s.name === name && (s.kind === "property" || s.kind === "function")) {
        return returnTypeOf(s.detail);
      }
    }
    for (const t of typeChain(receiver)) {
      for (const sig of MEMBERS[t] ?? []) {
        if (parseSignature(sig)?.name === name) return returnTypeOf(sig);
      }
    }
    return undefined;
  }

  /** Type of the nearest earlier declaration of `name`: `name: Type` or `val name = <initializer>`. */
  private variableType(name: string, before: number): string | undefined {
    for (let k = before - 1; k >= 0; k--) {
      const t = this.tokens[k];
      if (t.kind !== "identifier" || t.text !== name || isPunct(this.tokens[k - 1], ".")) continue;
      const next = this.tokens[k + 1];
      if (isPunct(next, ":") && !isPunct(this.tokens[k + 2], ":")) {
        const annotated = this.annotatedType(k + 2);
        if (annotated) return annotated;
      } else if (isPunct(next, "=") && !isPunct(this.tokens[k + 2], "=") && (isIdent(this.tokens[k - 1], "val") || isIdent(this.tokens[k - 1], "var"))) {
        return this.initializerType(k + 2);
      }
    }
    return undefined;
  }

  private annotatedType(start: number): string | undefined {
    let depth = 0;
    let text = "";
    for (let k = start; k < this.tokens.length; k++) {
      const t = this.tokens[k];
      if (isPunct(t, "<")) depth++;
      else if (isPunct(t, ">")) depth--;
      else if (depth === 0 && (isPunct(t, ",") || isPunct(t, ")") || isPunct(t, "=") || isPunct(t, "{") || isPunct(t, ";") || isPunct(t, "-"))) break;
      else if (depth === 0 && k > start && t.line !== this.tokens[start].line) break;
      text += t.text;
      if (depth < 0) return undefined;
    }
    return baseTypeName(text);
  }

  /** Type of the expression starting at `start`, when it is a literal or a (chained) call. */
  private initializerType(start: number): string | undefined {
    const first = this.tokens[start];
    if (!first) return undefined;
    let depth = 0;
    let last = start;
    for (let k = start; k < this.tokens.length; k++) {
      const t = this.tokens[k];
      if (t.kind === "punct") {
        if ("([{".includes(t.text)) depth++;
        else if (")]}".includes(t.text)) {
          depth--;
          if (depth < 0) break;
        } else if (depth === 0) {
          if (t.text === ";") break;
          if (t.text === "<" && this.isGenericCall(k)) {
            k = this.genericEnd(k);
            last = k;
            continue;
          }
          // Operators make the result type depend on both sides; only string concatenation is certain.
          if (!".?!".includes(t.text)) {
            return first.kind === "string" && t.text === "+" ? "String" : undefined;
          }
        }
      }
      if (depth === 0 && k > start) {
        const prev = this.tokens[k - 1];
        const continuesChain = isPunct(t, ".") || isPunct(t, "?") || isPunct(prev, ".") || isPunct(prev, "?");
        if (t.line !== prev.line && !continuesChain) break;
        if (t.kind !== "punct" && prev.kind !== "punct" && !continuesChain) break;
      }
      last = k;
    }
    return this.typeEndingAt(last);
  }

  /** Index of the `>` that closes the `<` at `lt`. */
  private genericEnd(lt: number): number {
    let depth = 0;
    for (let k = lt; k < this.tokens.length; k++) {
      if (isPunct(this.tokens[k], "<")) depth++;
      else if (isPunct(this.tokens[k], ">") && --depth === 0) return k;
    }
    return lt;
  }

  /** `listOf<Int>(...)`: `<` that follows an identifier and closes before a `(`. */
  private isGenericCall(lt: number): boolean {
    if (this.tokens[lt - 1]?.kind !== "identifier") return false;
    let depth = 0;
    for (let k = lt; k < this.tokens.length; k++) {
      if (isPunct(this.tokens[k], "<")) depth++;
      else if (isPunct(this.tokens[k], ">") && --depth === 0) return isPunct(this.tokens[k + 1], "(");
    }
    return false;
  }

  /** Name of the innermost class, interface or object whose body contains token `index`. */
  private enclosingType(index: number): string | undefined {
    const stack: (string | undefined)[] = [];
    let pending: string | undefined;
    for (let k = 0; k < index; k++) {
      const t = this.tokens[k];
      if (t.kind === "identifier") {
        if ((t.text === "class" || t.text === "interface" || t.text === "object") && this.tokens[k + 1]?.kind === "identifier") {
          pending = this.tokens[k + 1].text;
        } else if (t.text === "fun" || t.text === "val" || t.text === "var") {
          pending = undefined;
        }
      } else if (isPunct(t, "{")) {
        stack.push(pending);
        pending = undefined;
      } else if (isPunct(t, "}")) {
        stack.pop();
      }
    }
    for (let k = stack.length - 1; k >= 0; k--) {
      if (stack[k]) return stack[k];
    }
    return undefined;
  }

  private matchingBackwards(close: number, open: string, closeText: string): number {
    let depth = 0;
    for (let k = close; k >= 0; k--) {
      const t = this.tokens[k];
      if (isPunct(t, closeText) && !this.isArrow(k)) depth++;
      else if (isPunct(t, open)) {
        depth--;
        if (depth === 0) return k;
      }
    }
    return -1;
  }

  /** The `>` of `->`. */
  private isArrow(k: number): boolean {
    const prev = this.tokens[k - 1];
    return isPunct(this.tokens[k], ">") && isPunct(prev, "-") && prev.end === this.tokens[k].start;
  }
}
