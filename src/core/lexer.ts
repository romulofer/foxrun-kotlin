export type TokenKind = "identifier" | "number" | "string" | "char" | "comment" | "punct";

export interface Token {
  kind: TokenKind;
  /** Token text. Backtick identifiers are stored without the backticks. */
  text: string;
  /** Offset of the first character. */
  start: number;
  /** Offset one past the last character. */
  end: number;
  /** Zero based line of `start`. */
  line: number;
}

export interface Range {
  start: number;
  end: number;
}

export interface LexResult {
  tokens: Token[];
  /** Code regions inside string templates (`${...}`), excluding the delimiters. */
  templateRanges: Range[];
}

const IDENT_START = /[\p{L}_]/u;
const IDENT_PART = /[\p{L}\p{N}_]/u;

export function lex(src: string): LexResult {
  const tokens: Token[] = [];
  const templateRanges: Range[] = [];
  const lineStarts = computeLineStarts(src);
  const lineOf = (offset: number) => lineAt(lineStarts, offset);
  const n = src.length;

  const push = (kind: TokenKind, start: number, end: number, text = src.slice(start, end)) => {
    tokens.push({ kind, text, start, end, line: lineOf(start) });
  };

  // Scans a template expression body starting right after `${`.
  // Returns the offset of the closing `}` (or n when unterminated).
  const scanTemplate = (from: number): number => {
    let depth = 1;
    let i = from;
    while (i < n) {
      const c = src[i];
      if (c === "\"") {
        i = src.startsWith("\"\"\"", i) ? scanRawString(i + 3) : scanString(i + 1);
        continue;
      }
      if (c === "'") {
        i = scanChar(i + 1);
        continue;
      }
      if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) return i;
      }
      i++;
    }
    return n;
  };

  const handleTemplate = (i: number): number => {
    const bodyStart = i + 2;
    const close = scanTemplate(bodyStart);
    templateRanges.push({ start: bodyStart, end: close });
    return close < n ? close + 1 : n;
  };

  // Each scanner starts after the opening delimiter and returns the offset after the closing one.
  function scanString(from: number): number {
    let i = from;
    while (i < n) {
      const c = src[i];
      if (c === "\\") {
        i += 2;
      } else if (c === "\"") {
        return i + 1;
      } else if (c === "\n") {
        return i;
      } else if (c === "$" && src[i + 1] === "{") {
        i = handleTemplate(i);
      } else {
        i++;
      }
    }
    return n;
  }

  function scanRawString(from: number): number {
    let i = from;
    while (i < n) {
      if (src.startsWith("\"\"\"", i)) {
        let end = i + 3;
        while (src[end] === "\"") end++;
        return end;
      }
      if (src[i] === "$" && src[i + 1] === "{") {
        i = handleTemplate(i);
      } else {
        i++;
      }
    }
    return n;
  }

  function scanChar(from: number): number {
    let i = from;
    while (i < n) {
      const c = src[i];
      if (c === "\\") i += 2;
      else if (c === "'") return i + 1;
      else if (c === "\n") return i;
      else i++;
    }
    return n;
  }

  let i = 0;
  while (i < n) {
    const c = src[i];

    if (c === " " || c === "\t" || c === "\r" || c === "\n" || c === "\f") {
      i++;
      continue;
    }

    if (c === "/" && src[i + 1] === "/") {
      const nl = src.indexOf("\n", i);
      const end = nl === -1 ? n : nl;
      push("comment", i, end);
      i = end;
      continue;
    }

    if (c === "/" && src[i + 1] === "*") {
      let depth = 1;
      let j = i + 2;
      while (j < n && depth > 0) {
        if (src[j] === "/" && src[j + 1] === "*") {
          depth++;
          j += 2;
        } else if (src[j] === "*" && src[j + 1] === "/") {
          depth--;
          j += 2;
        } else {
          j++;
        }
      }
      push("comment", i, j);
      i = j;
      continue;
    }

    if (c === "\"") {
      const end = src.startsWith("\"\"\"", i) ? scanRawString(i + 3) : scanString(i + 1);
      push("string", i, end);
      i = end;
      continue;
    }

    if (c === "'") {
      const end = scanChar(i + 1);
      push("char", i, end);
      i = end;
      continue;
    }

    if (c === "`") {
      const close = src.indexOf("`", i + 1);
      const nl = src.indexOf("\n", i + 1);
      if (close !== -1 && (nl === -1 || close < nl)) {
        push("identifier", i, close + 1, src.slice(i + 1, close));
        i = close + 1;
        continue;
      }
      push("punct", i, i + 1);
      i++;
      continue;
    }

    if (c >= "0" && c <= "9") {
      let j = i + 1;
      while (j < n) {
        const d = src[j];
        if (/[0-9A-Za-z_]/.test(d)) j++;
        else if (d === "." && /[0-9]/.test(src[j + 1] ?? "")) j++;
        else if ((d === "+" || d === "-") && /[eE]/.test(src[j - 1]) && !/^0[xX]/.test(src.slice(i, j))) j++;
        else break;
      }
      push("number", i, j);
      i = j;
      continue;
    }

    if (IDENT_START.test(c)) {
      let j = i + 1;
      while (j < n && IDENT_PART.test(src[j])) j++;
      push("identifier", i, j);
      i = j;
      continue;
    }

    push("punct", i, i + 1);
    i++;
  }

  return { tokens, templateRanges };
}

/** Tokens that carry meaning for parsing: everything except comments. */
export function codeTokens(src: string): Token[] {
  return lex(src).tokens.filter((t) => t.kind !== "comment");
}

export type OffsetContext = "code" | "comment" | "string";

/** Classifies an offset (a cursor position) as code, comment or string. */
export function contextAt(src: string, offset: number): OffsetContext {
  const { tokens, templateRanges } = lex(src);
  for (const r of templateRanges) {
    if (offset >= r.start && offset <= r.end) return "code";
  }
  for (const t of tokens) {
    if (t.start >= offset) break;
    if (offset > t.start && offset < t.end) {
      return t.kind === "comment" ? "comment" : t.kind === "string" || t.kind === "char" ? "string" : "code";
    }
    // Cursor at the end of a line comment, or of an unterminated string, is still inside it.
    if (offset === t.end) {
      if (t.kind === "comment" && (t.text.startsWith("//") || t.text.length < 4 || !t.text.endsWith("*/"))) {
        return "comment";
      }
      if ((t.kind === "string" || t.kind === "char") && !isTerminated(t)) return "string";
    }
  }
  return "code";
}

function isTerminated(t: Token): boolean {
  const text = t.text;
  if (t.kind === "char") return text.length >= 2 && text.endsWith("'") && !text.endsWith("\\'");
  if (text.startsWith("\"\"\"")) return text.length >= 6 && text.endsWith("\"\"\"");
  if (text.length < 2 || !text.endsWith("\"")) return false;
  let backslashes = 0;
  for (let k = text.length - 2; k >= 0 && text[k] === "\\"; k--) backslashes++;
  return backslashes % 2 === 0;
}

export function computeLineStarts(src: string): number[] {
  const starts = [0];
  for (let i = 0; i < src.length; i++) {
    if (src[i] === "\n") starts.push(i + 1);
  }
  return starts;
}

export function lineAt(lineStarts: number[], offset: number): number {
  let lo = 0;
  let hi = lineStarts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (lineStarts[mid] <= offset) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export function isIdent(t: Token | undefined, text: string): boolean {
  return t !== undefined && t.kind === "identifier" && t.text === text;
}

export function isPunct(t: Token | undefined, text: string): boolean {
  return t !== undefined && t.kind === "punct" && t.text === text;
}
