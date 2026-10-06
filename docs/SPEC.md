# Foxrun for Kotlin: Specification

## 1. Goal

A lightweight VS Code extension for Kotlin, written entirely in TypeScript, that gives:

1. Syntax highlighting for `.kt` and `.kts` files.
2. Autocomplete (keywords, snippets, standard library, symbols declared in the workspace).
3. A "Run" button (CodeLens) above every `main` function that compiles and runs the file.
4. Unit and integration tests for all of the above.

No JVM language server is required for features 1 and 2. Feature 3 needs a local Kotlin compiler and a JDK.

## 2. Scope

### In scope (v0.1)

| Area | Requirement |
|------|-------------|
| Language registration | Language id `kotlin`, extensions `.kt`, `.kts`. Comments, brackets, auto closing pairs, folding markers, indentation rules. |
| Syntax highlighting | TextMate grammar `source.kotlin` covering: line/block/KDoc comments, strings (plain, raw `"""`, templates `$x` and `${expr}`, escapes), chars, numbers (dec, hex, bin, long, unsigned, float, underscores), keywords (hard, soft, modifiers), annotations, declarations (`fun`, `class`, `interface`, `object`, `typealias`, `val`, `var`), types, operators, labels. |
| Autocomplete | Kotlin hard/soft/modifier keywords. Snippets (`main`, `fun`, `class`, `data class`, `when`, `for`, `if`, `try`, `println`, ...). Common stdlib functions and types. Identifiers declared in the current document (functions, classes, properties, params). Top level declarations from other `.kt` files in the workspace (indexed, refreshed on save). Member completion after `.` is out of scope for v0.1 (only document words are offered). |
| Run button | CodeLens `Run` (no debug in v0.1), shown above each top level `fun main(...)` (with or without args, `suspend` allowed). Also on `.kts` scripts (whole file). Command `kotlin.run` available from editor title bar and command palette. |
| Run strategy | Single file mode: `kotlinc <file> -include-runtime -d <tmp>/<name>.jar` then `java -cp <jar> <FacadeClass>`. Scripts: `kotlinc -script <file>`. Processes are spawned directly (no shell) and shown in a pseudoterminal named `Kotlin Run` that prints only program output plus short status lines; stdin is forwarded. File is saved before running. |
| Configuration | `kotlin.run.kotlincPath` (default `kotlinc`), `kotlin.run.javaPath` (default `java`), `kotlin.run.args` (program args), `kotlin.run.jvmArgs`, `kotlin.run.clearTerminal` (default `true`), `kotlin.completion.workspaceIndex` (default `true`). |
| Tests | Unit tests (Mocha, no VS Code runtime) for pure logic. Grammar tests (`vscode-tmgrammar-test`). Integration tests (`@vscode/test-cli` + `@vscode/test-electron`) that activate the extension in a real VS Code. |

### Out of scope (v0.1)

- Gradle / Maven project awareness (multi file compile). Planned for v0.2: if a `build.gradle(.kts)` is found, offer `gradle run`.
- Debugging, type aware completion, diagnostics, go to definition, formatting.
- Kotlin Multiplatform, Android.

## 3. Architecture

```
src/
  extension.ts            activate/deactivate, wires providers and commands
  core/                   pure TypeScript, no 'vscode' import, unit tested
    mainDetector.ts       finds top level main functions (line, name, package)
    lexer.ts              minimal tokenizer: skips comments and strings, yields identifiers
    symbolExtractor.ts    extracts declarations (fun/class/val/var/object/...) from source
    keywords.ts           keyword lists
    stdlib.ts             stdlib functions/types for completion
    snippets.ts           snippet definitions
    runCommand.ts         builds compile/run shell commands for a file + settings
  providers/              thin VS Code adapters over core/
    completionProvider.ts
    runCodeLensProvider.ts
    workspaceIndex.ts     FileSystemWatcher + symbol cache
  commands/
    run.ts                kotlin.run: save, build run steps, hand them to the runner
  terminal/
    runTerminal.ts        Pseudoterminal `Kotlin Run` over core/processSession.ts
syntaxes/kotlin.tmLanguage.json
language-configuration.json
test/
  unit/                   mocha, imports src/core only
  grammar/                *.kt fixture files with tmgrammar-test assertions
  integration/            runs inside VS Code via @vscode/test-cli
```

Design rule: all logic that can live without the `vscode` module lives in `src/core` so it is unit testable in plain Node.

## 4. Behaviour details

### 4.1 Main detection

A function is a runnable entry point when it is:

- top level (brace depth 0, ignoring braces in comments and strings),
- named `main`,
- declared with `fun`, optionally preceded by modifiers/annotations (`suspend`, `public`, `internal`, `@JvmStatic`, ...),
- with zero parameters or one parameter of type `Array<String>` / `vararg String`.

`main` inside `object`/`companion object` with `@JvmStatic` is not supported in v0.1.

### 4.2 Run command

1. Save the document if dirty.
2. Check `kotlinc` is reachable (on failure show error with a "Open Settings" action).
3. Build run steps with `core/runCommand.ts` (argv lists, script vs jar mode, args).
4. Reuse or create the `Kotlin Run` pseudoterminal, optionally clear it, run the steps with `core/processSession.ts`. Output shows `Compiling X.kt...`, program output, then `Process finished with exit code N (Ts)`.

Jar output dir: extension `globalStorageUri`/`build`, one jar per source file name hash to avoid clashes.

### 4.3 Completion

Ordering (sortText): document symbols, workspace symbols, keywords, snippets, stdlib. Suppressed inside comments and strings (template expressions `${...}` excluded from suppression).

## 5. Acceptance criteria

- Opening a `.kt` file sets language mode `Kotlin` and colors keywords, strings, comments, numbers, annotations.
- Typing `pri` offers `println` and `private`.
- A file with `fun main() { println("hi") }` shows `Run` above `fun main`; clicking it prints `hi` in terminal `Kotlin Run`.
- `npm test` runs unit + grammar tests green. `npm run test:integration` runs integration tests green (headless with `xvfb-run` on Linux).
- `npm run package` produces a `.vsix`.

## 6. Tooling

| Tool | Use |
|------|-----|
| TypeScript (latest) | source language, `tsc --noEmit` type check |
| esbuild | bundle `src/extension.ts` into `dist/extension.js` |
| Mocha | unit tests |
| vscode-tmgrammar-test | grammar tests |
| @vscode/test-cli, @vscode/test-electron | integration tests |
| @vscode/vsce | packaging |

## 7. v0.2 additions

Scope: faster runs, compiler diagnostics, setup help, member completion, debugging, run arguments, grammar and highlighting upgrades. Gradle/Maven stays out of scope.

### 7.1 Run cache (faster runs)

- The jar name is derived from the file path and a hash of the source content plus the resolved `kotlinc` path. If that jar already exists, the compile step is skipped and the terminal prints `Using cached build`.
- Old jars for the same source path are deleted after a successful new compile, so the cache does not grow without bound.
- `kotlin.run.useCache` (default `true`) turns the cache off.
- Command `Kotlin: Clear Build Cache` empties the build directory.
- Core: `runCommand.ts` gains `cacheKey()` and a `needsCompile` flag on the target; no `vscode` import.

### 7.2 Compiler diagnostics

- Core `kotlincDiagnostics.ts` parses `kotlinc` output lines of the form `path:line:col: error|warning|info: message` (also `exception:` and lines without a column) into `{ file, line, column, severity, message }`. Continuation lines (source excerpt and `^` marker) are dropped.
- The compile step's output is collected by `ProcessSession` (new `onCompileOutput`) and, when the step ends, published to a `DiagnosticCollection` named `kotlinc`. The collection is cleared for the file at the start of every run.
- The `Kotlin Run` terminal registers a `TerminalLinkProvider` that makes `path:line:col` in compiler output clickable.
- `kotlin.run.showDiagnostics` (default `true`).

### 7.3 Setup help

- `findExecutable` also looks in `KOTLIN_HOME/bin`, `JAVA_HOME/bin`, `~/.sdkman/candidates/{kotlin,java}/current/bin` and common Homebrew paths when the configured command is not on `PATH`.
- If `kotlinc` or `java` is still missing, the error offers `Open Settings` and `Install Help`. `Install Help` opens the Kotlin install page (and the JDK page for `java`).
- Command `Kotlin: Check Setup` reports the resolved paths and versions of `kotlinc` and `java` in a single message, or what is missing.
- Core: `setupCheck.ts` builds the candidate path list and parses `-version` output; the adapter does the spawning.

### 7.4 Member completion after `.`

- Core `memberCompletion.ts` resolves the receiver of `expr.` from the text before the cursor to a type name using, in order: a literal (`"s"` is `String`, `1` is `Int`, `1.0` is `Double`, `true` is `Boolean`, `listOf(...)` is `List`, `mutableListOf` is `MutableList`, `mapOf` is `Map`, `setOf` is `Set`); a declared type annotation (`val x: T`, parameters); a constructor call initializer (`val x = Foo(...)`); `this`.
- Members come from a table of standard library types in `stdlibMembers.ts` (String, CharSequence, Int/Long/Double/Boolean/Char, List/MutableList, Set/MutableSet, Map/MutableMap, Array, Sequence, Pair, Result, Regex, StringBuilder, Iterable collection extensions) and from classes declared in the current file or workspace (properties and functions, from `symbolExtractor`).
- Nullable receivers (`T?`) also offer the same members.
- When the receiver is unknown, nothing is offered after `.` except document words (current behaviour is kept as the fallback).
- Members are sorted before the generic list, and function items insert `name($0)`.

### 7.5 Debugging

- A `Debug` CodeLens sits next to `Run` above every `main`. Command `kotlin.debug`, also in the editor title run menu and the palette.
- Strategy: compile as for Run (cache applies), then launch `java -agentlib:jdwp=transport=dt_socket,server=y,suspend=y,address=127.0.0.1:<free port> -cp <jar> <Main> <args>` in the `Kotlin Run` terminal, wait until the agent prints `Listening for transport`, then call `vscode.debug.startDebugging` with a `java` attach configuration (`hostName`, `port`, `projectName` unset).
- This needs a Java debugger extension: `vscjava.vscode-java-debug` (debug type `java`) or `oracle.oracle-java` (debug type `jdk`, port as a string); the first installed one is used. If none is installed, show a message with an action that opens Debugger for Java in the Extensions view. No extension dependency is declared, so Run keeps working without them.
- Scripts (`.kts`) cannot be debugged; the lens is not shown for them.
- Core: `buildDebugSteps()` in `runCommand.ts`, `freePort` helper in the adapter.

### 7.6 Run with arguments and environment

- Command `Kotlin: Run With Arguments...` shows an input box prefilled with the last arguments used for that file (stored in `workspaceState`), parsed with shell style quoting by core `argsParser.ts`, then runs normally with these arguments instead of `kotlin.run.args`.
- New setting `kotlin.run.env` (object, string values) merged over the process environment for the run step. Applies to Run and Debug.
- `ProcessSession` gets an `env` parameter.

### 7.7 Grammar and highlighting

Grammar fixes and additions (each with a tmgrammar test):

- Multi dollar interpolation (`$$"..."`, `$${x}`), nested quotes and nested templates inside `${ ... }`.
- `context(...)` parameters, `value class`, `fun interface`, `data object`, `enum class`, `annotation class`, `sealed interface`, `expect`/`actual`, `when` with guards (`if` after a condition), `typealias`.
- Annotation use site targets (`@get:JvmName`, `@field:`), annotations with arguments, backtick identifiers.
- Raw string `trimIndent()`/`trimMargin()` untouched; no change in scopes.

Highlighting upgrades (scopes only, no semantic provider):

- Function calls (`entity.name.function.call`), including generic calls `foo<T>(...)`, distinct from declarations.
- Generic type parameters in declarations and arguments, type constraints (`where`), nullable `?` and star projections.
- Named arguments (`variable.parameter.named`), lambda parameters `{ a, b -> }`, implicit `it`, `this@label` and `return@label`.
- Constants (`UPPER_SNAKE`), enum entries, properties after `.`, companion object references.
- KDoc tags (`@param`, `@return`, `[Link]`) scoped inside doc comments.
- Numeric literal suffixes, escape sequences and Unicode escapes keep their current scopes.

### 7.8 Acceptance criteria (v0.2)

- Running an unchanged file twice skips compile the second time (unit test on `needsCompile`, integration test checks no `compile` step).
- A file with a type error shows a red squiggle at the right line and column and an entry in Problems; fixing it and rerunning clears it.
- With `kotlinc` removed from `PATH` but present under `~/.sdkman`, run still works.
- `"abc".` offers `length`, `uppercase`, `substring`; `listOf(1).` offers `map`, `filter`, `size`; `val p = Person("a"); p.` offers `Person` members.
- `Debug` lens starts a debug session that stops at a breakpoint (manual check, plus unit tests on the generated command and the java debug presence check).
- `Run With Arguments...` passes the arguments to `main` and remembers them.
- `npm test` and `npm run test:integration` are green; `npm run package` works.
