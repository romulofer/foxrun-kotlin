import { codeTokens, isIdent, isPunct, Token } from "./lexer";

export interface MainFunction {
  /** Zero based line of the `fun` keyword. */
  line: number;
  /** Zero based column of the `fun` keyword. */
  character: number;
  /** True when main declares the `Array<String>` / `vararg String` parameter. */
  hasArgs: boolean;
}

export interface KotlinFileInfo {
  packageName: string | undefined;
  /** Value of `@file:JvmName("...")`, when present. */
  jvmName: string | undefined;
  mains: MainFunction[];
}

export function analyzeFile(src: string): KotlinFileInfo {
  const tokens = codeTokens(src);
  return {
    packageName: findPackage(tokens),
    jvmName: findJvmName(tokens),
    mains: findMains(tokens, src),
  };
}

export function findMainFunctions(src: string): MainFunction[] {
  return findMains(codeTokens(src), src);
}

function findMains(tokens: Token[], src: string): MainFunction[] {
  const result: MainFunction[] = [];
  let depth = 0;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.kind === "punct") {
      if (t.text === "{" || t.text === "(" || t.text === "[") depth++;
      else if (t.text === "}" || t.text === ")" || t.text === "]") depth = Math.max(0, depth - 1);
      continue;
    }
    if (depth !== 0 || !isIdent(t, "fun")) continue;
    const name = tokens[i + 1];
    const open = tokens[i + 2];
    if (!isIdent(name, "main") || !isPunct(open, "(")) continue;

    const close = matchingParen(tokens, i + 2);
    if (close === -1) continue;
    const params = tokens.slice(i + 3, close);
    const hasArgs = params.length > 0;
    if (hasArgs && !isMainParameter(params)) continue;

    const lineStart = src.lastIndexOf("\n", t.start - 1) + 1;
    result.push({ line: t.line, character: t.start - lineStart, hasArgs });
  }
  return result;
}

function isMainParameter(params: Token[]): boolean {
  const text = params.map((p) => p.text).join(" ").replace(/\s*,\s*$/, "");
  return (
    /^[\p{L}_][\p{L}\p{N}_]* : Array < (?:out )?String >$/u.test(text) ||
    /^vararg [\p{L}_][\p{L}\p{N}_]* : String$/u.test(text)
  );
}

function matchingParen(tokens: Token[], openIndex: number): number {
  let depth = 0;
  for (let i = openIndex; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.kind !== "punct") continue;
    if (t.text === "(") depth++;
    else if (t.text === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function findPackage(tokens: Token[]): string | undefined {
  const idx = tokens.findIndex((t) => isIdent(t, "package"));
  if (idx === -1) return undefined;
  const parts: string[] = [];
  let i = idx + 1;
  const line = tokens[idx].line;
  while (i < tokens.length && tokens[i].line === line) {
    const t = tokens[i];
    if (t.kind === "identifier") parts.push(t.text);
    else if (!isPunct(t, ".")) break;
    i++;
  }
  return parts.length > 0 ? parts.join(".") : undefined;
}

function findJvmName(tokens: Token[]): string | undefined {
  for (let i = 0; i + 5 < tokens.length; i++) {
    if (
      isPunct(tokens[i], "@") &&
      isIdent(tokens[i + 1], "file") &&
      isPunct(tokens[i + 2], ":") &&
      isIdent(tokens[i + 3], "JvmName") &&
      isPunct(tokens[i + 4], "(") &&
      tokens[i + 5].kind === "string"
    ) {
      return tokens[i + 5].text.replace(/^"+|"+$/g, "");
    }
  }
  return undefined;
}

/**
 * JVM class name the Kotlin compiler generates for top level declarations of a file,
 * e.g. `com.example.HelloWorldKt` for `package com.example` in `helloWorld.kt`.
 */
export function facadeClassName(fileName: string, info: Pick<KotlinFileInfo, "packageName" | "jvmName">): string {
  const simple = info.jvmName ?? fileFacadeShortName(fileName);
  return info.packageName ? `${info.packageName}.${simple}` : simple;
}

export function fileFacadeShortName(fileName: string): string {
  const base = fileName.replace(/^.*[\\/]/, "").replace(/\.kts?$/, "");
  let sanitized = "";
  for (const ch of base) {
    sanitized += /[\p{L}\p{N}_$]/u.test(ch) ? ch : "_";
  }
  if (sanitized.length === 0 || !/[\p{L}_$]/u.test(sanitized[0])) sanitized = "_" + sanitized;
  const first = sanitized[0];
  const capitalized = first >= "a" && first <= "z" ? first.toUpperCase() + sanitized.slice(1) : sanitized;
  return capitalized + "Kt";
}
