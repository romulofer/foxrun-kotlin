export interface KotlinSnippet {
  /** Text the user types to trigger the snippet. */
  prefix: string;
  description: string;
  /** Snippet body in VS Code snippet syntax. Lines are indented with `\t`. */
  body: string;
}

const s = (prefix: string, description: string, ...lines: string[]): KotlinSnippet => ({
  prefix,
  description,
  body: lines.join("\n"),
});

export const SNIPPETS: readonly KotlinSnippet[] = [
  s("main", "main function", "fun main() {", "\t$0", "}"),
  s("maina", "main function with arguments", "fun main(args: Array<String>) {", "\t$0", "}"),
  s("fun", "function", "fun ${1:name}(${2}): ${3:Unit} {", "\t$0", "}"),
  s("funexpr", "expression body function", "fun ${1:name}(${2}) = ${0}"),
  s("class", "class", "class ${1:Name}(${2}) {", "\t$0", "}"),
  s("dataclass", "data class", "data class ${1:Name}(${2:val property: Type})"),
  s("enumclass", "enum class", "enum class ${1:Name} {", "\t${0:A, B}", "}"),
  s("sealedinterface", "sealed interface", "sealed interface ${1:Name} {", "\t$0", "}"),
  s("interface", "interface", "interface ${1:Name} {", "\t$0", "}"),
  s("object", "object declaration", "object ${1:Name} {", "\t$0", "}"),
  s("companion", "companion object", "companion object {", "\t$0", "}"),
  s("if", "if statement", "if (${1:condition}) {", "\t$0", "}"),
  s("ifelse", "if else statement", "if (${1:condition}) {", "\t${2}", "} else {", "\t$0", "}"),
  s("when", "when expression", "when (${1:value}) {", "\t${2:pattern} -> ${3}", "\telse -> ${0}", "}"),
  s("for", "for loop over a collection", "for (${1:item} in ${2:items}) {", "\t$0", "}"),
  s("fori", "for loop over an index range", "for (${1:i} in ${2:0} until ${3:n}) {", "\t$0", "}"),
  s("while", "while loop", "while (${1:condition}) {", "\t$0", "}"),
  s("try", "try catch", "try {", "\t${1}", "} catch (${2:e}: ${3:Exception}) {", "\t$0", "}"),
  s("println", "print a line", "println(${0})"),
  s("printv", "print a value with its name", "println(\"${1:value} = \\$${1:value}\")"),
  s("val", "read only property", "val ${1:name} = ${0}"),
  s("var", "mutable property", "var ${1:name} = ${0}"),
  s("lateinit", "lateinit property", "lateinit var ${1:name}: ${0:Type}"),
  s("lazy", "lazy property", "val ${1:name} by lazy { ${0} }"),
  s("ext", "extension function", "fun ${1:Type}.${2:name}(${3}): ${4:Unit} {", "\t$0", "}"),
  s("test", "JUnit test function", "@Test", "fun `${1:does something}`() {", "\t$0", "}"),
];
