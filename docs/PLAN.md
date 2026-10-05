# Run Kotlin VSCode: Implementation Plan

See [SPEC.md](SPEC.md). Each phase ends green (`npm run check && npm test`) and with a commit.

## Phase 0: Scaffold

- [x] `git init`, `.gitignore`, `.vscodeignore`
- [x] `package.json` (extension manifest, scripts), `tsconfig.json`, esbuild script
- [x] Mocha config, `@vscode/test-cli` config
- [x] Empty `activate` that registers nothing, builds and bundles

## Phase 1: Language + syntax highlighting

- [x] `language-configuration.json` (comments, brackets, pairs, folding, indent)
- [x] `syntaxes/kotlin.tmLanguage.json`
- [x] Grammar fixtures under `test/grammar/` with scope assertions

## Phase 2: Core logic (pure TS, unit tested)

- [ ] `lexer.ts` (comment/string aware scanning, brace depth)
- [ ] `mainDetector.ts` + tests
- [ ] `symbolExtractor.ts` + tests
- [ ] `keywords.ts`, `stdlib.ts`, `snippets.ts`
- [ ] `runCommand.ts` + tests (quoting, script mode, args)

## Phase 3: VS Code adapters

- [ ] `runCodeLensProvider.ts`
- [ ] `commands/run.ts` (`kotlin.run`), editor title button, palette entry
- [ ] `completionProvider.ts`
- [ ] `workspaceIndex.ts` (watcher, cache)
- [ ] Settings contribution

## Phase 4: Integration tests

- [ ] Activation on `.kt`, language id is `kotlin`
- [ ] CodeLens present on `main` fixture, absent on non main fixture
- [ ] Completion returns keywords, snippets, document symbols
- [ ] `kotlin.run` builds expected command (terminal stubbed via injected runner)

## Phase 5: Polish

- [ ] README, CHANGELOG, icon placeholder, LICENSE
- [ ] `npm run package` makes `.vsix`

## Later (v0.2+)

- Gradle/Maven run (`gradle run`, `mvn exec:java`)
- `main` in `object` with `@JvmStatic`
- Optional bridge to an external Kotlin language server for type aware completion
