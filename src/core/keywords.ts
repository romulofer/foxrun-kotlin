/** https://kotlinlang.org/docs/keyword-reference.html */
export const HARD_KEYWORDS = [
  "as", "break", "class", "continue", "do", "else", "false", "for", "fun", "if", "in",
  "interface", "is", "null", "object", "package", "return", "super", "this", "throw",
  "true", "try", "typealias", "typeof", "val", "var", "when", "while",
] as const;

export const SOFT_KEYWORDS = [
  "by", "catch", "constructor", "delegate", "dynamic", "field", "file", "finally", "get",
  "import", "init", "param", "property", "receiver", "set", "setparam", "value", "where",
] as const;

export const MODIFIER_KEYWORDS = [
  "abstract", "actual", "annotation", "companion", "const", "crossinline", "data", "enum",
  "expect", "external", "final", "infix", "inline", "inner", "internal", "lateinit",
  "noinline", "open", "operator", "out", "override", "private", "protected", "public",
  "reified", "sealed", "suspend", "tailrec", "vararg",
] as const;

export const ALL_KEYWORDS: readonly string[] = [
  ...new Set<string>([...HARD_KEYWORDS, ...SOFT_KEYWORDS, ...MODIFIER_KEYWORDS]),
].sort();
