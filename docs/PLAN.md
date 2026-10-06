# Foxrun for Kotlin: Implementation Plan

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

- [x] `lexer.ts` (comment/string aware scanning, brace depth)
- [x] `mainDetector.ts` + tests
- [x] `symbolExtractor.ts` + tests
- [x] `keywords.ts`, `stdlib.ts`, `snippets.ts`
- [x] `runCommand.ts` + tests (quoting, script mode, args)

## Phase 3: VS Code adapters

- [x] `runCodeLensProvider.ts`
- [x] `commands/run.ts` (`kotlin.run`), editor title button, palette entry
- [x] `completionProvider.ts`
- [x] `workspaceIndex.ts` (watcher, cache)
- [x] Settings contribution

## Phase 4: Integration tests

- [x] Activation on `.kt`, language id is `kotlin`
- [x] CodeLens present on `main` fixture, absent on non main fixture
- [x] Completion returns keywords, snippets, document symbols
- [x] `kotlin.run` builds expected command (terminal stubbed via injected runner)

## Phase 5: Polish

- [x] README, CHANGELOG, LICENSE
- [x] `npm run package` makes `.vsix`

## v0.2 (see SPEC section 7)

Each phase ends with `npm run check && npm test`, a commit, and docs/changelog updates where visible.

### Phase 6: Grammar and highlighting (7.7)

- [x] Review `syntaxes/kotlin.tmLanguage.json` against the spec list
- [x] Failing grammar tests first, then grammar changes
- [x] Function call, generics, named args, lambda params, `it`, labels, constants, enum entries, KDoc tags

### Phase 7: Run cache and run settings (7.1, 7.6)

- [x] `cacheKey`, `needsCompile`, stale jar cleanup, `useCache` setting, clear cache command
- [x] `argsParser.ts`, `kotlin.run.env`, `Run With Arguments...` command
- [x] `ProcessSession` env parameter, tests

### Phase 8: Setup help (7.3)

- [x] Extended `findExecutable` search paths, `setupCheck.ts`
- [x] `Install Help` action, `Kotlin: Check Setup` command

### Phase 9: Diagnostics (7.2)

- [x] `kotlincDiagnostics.ts` parser with tests
- [x] Collect compile output in `ProcessSession`, publish `DiagnosticCollection`
- [x] Terminal link provider

### Phase 10: Member completion (7.4)

- [ ] `stdlibMembers.ts`, `memberCompletion.ts` with tests
- [ ] Wire into `completionProvider.ts` on `.`

### Phase 11: Debugging (7.5)

- [ ] `buildDebugSteps`, `kotlin.debug`, `Debug` CodeLens
- [ ] Java debug extension check, attach flow, tests

### Phase 12: Release 0.2.0

- [ ] README (EN and PT), CHANGELOG, version bump, `.vsix`, integration tests green

## Later (v0.3+)

- Gradle/Maven run (`gradle run`, `mvn exec:java`)
- `main` in `object` with `@JvmStatic`
- Optional bridge to an external Kotlin language server for type aware completion
