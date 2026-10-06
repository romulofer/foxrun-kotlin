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
