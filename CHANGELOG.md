# Changelog

## 0.2.0

- Renamed to Foxrun for Kotlin with a new, original icon.
- Debug button: a `Debug` CodeLens starts the program suspended with a JDWP agent and attaches Debugger for Java or the Oracle Java Platform debugger.
- Compiler errors and warnings appear in the Problems panel; `File.kt:line:col` in the terminal is clickable (`kotlin.run.showDiagnostics`).
- Faster reruns: the compiled jar is reused while the source and compiler are unchanged, stale jars are removed (`kotlin.run.useCache`, `Kotlin: Clear Build Cache`).
- `kotlinc` and `java` are also found through `KOTLIN_HOME`, `JAVA_HOME`, SDKMAN and Homebrew. The missing tool error offers `Install Help`, and `Kotlin: Check Setup` reports what was found.
- Member completion after a dot for standard library types and for classes declared in the file or the workspace, including chained calls.
- `Kotlin: Run Kotlin File With Arguments...` and the `kotlin.run.env` setting.
- Grammar: multi dollar strings, `context(...)` parameters, type parameters, named arguments, lambda parameters, implicit `it`, property access, KDoc links, nullable markers and star projections.

## 0.1.0

- Kotlin language support for `.kt` and `.kts` files.
- TextMate grammar: comments, KDoc, strings and templates, numbers, keywords, annotations, declarations, labels and operators.
- Autocomplete: keywords, snippets, common standard library declarations, symbols from the current file and top level declarations from the workspace.
- Run CodeLens above `main` functions and on `.kts` scripts, plus a Run button in the editor title bar.
- Quiet `Kotlin Run` terminal: shows only compile status, program output and exit code. Supports stdin and `Ctrl+C`.
