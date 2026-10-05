# Run Kotlin

Lightweight Kotlin support for VS Code, written in TypeScript. No language server needed.

## Features

- **Syntax highlighting** for `.kt` and `.kts`: comments, KDoc, raw strings, string templates, numbers, annotations, declarations, labels.
- **Autocomplete**: keywords, snippets (`main`, `fun`, `dataclass`, `when`, `fori`, ...), common standard library functions and types, symbols declared in the current file, and top level declarations from other Kotlin files in the workspace.
- **Run button**: a `Run` CodeLens above every top level `fun main` (and `Run Script` on `.kts` files). Also available from the editor title bar and the command `Kotlin: Run Kotlin File`.

## Requirements

Running code needs a Kotlin compiler and a JDK:

- `kotlinc` ([install](https://kotlinlang.org/docs/command-line.html))
- `java` 8 or newer

Both must be on `PATH`, or configured in the settings below.

## How running works

- `.kt` files: `kotlinc <file> -include-runtime -d <jar>` then `java -cp <jar> <package>.<File>Kt`. Jars are kept in the extension storage folder.
- `.kts` scripts: `kotlinc -script <file>`.

The command runs in a terminal named `Kotlin Run`, so programs can read from stdin. Only single file programs are supported for now; Gradle and Maven projects are planned.

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `kotlin.run.kotlincPath` | `kotlinc` | Path to the Kotlin compiler. |
| `kotlin.run.javaPath` | `java` | Path to the java executable. |
| `kotlin.run.args` | `[]` | Arguments passed to `main`. |
| `kotlin.run.jvmArgs` | `[]` | Arguments passed to the JVM. |
| `kotlin.run.clearTerminal` | `true` | Start each run in a fresh terminal. |
| `kotlin.completion.workspaceIndex` | `true` | Offer top level declarations from other workspace files. |

## Development

```sh
npm install
npm run build              # bundle to dist/extension.js
npm test                   # unit + grammar tests
npm run test:integration   # tests inside VS Code (use xvfb-run -a on headless Linux)
npm run package            # build a .vsix
```

Press `F5` in VS Code to launch an Extension Development Host with `test/fixtures` open.

See `docs/SPEC.md` and `docs/PLAN.md` for the design.

## License

MIT. See `LICENSE`.
