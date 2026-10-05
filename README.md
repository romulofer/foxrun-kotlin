<p align="center">
  <img src="images/icon.png" width="128" alt="Run Kotlin icon">
</p>

<h1 align="center">Run Kotlin</h1>

<p align="center">
  Kotlin syntax highlighting, autocomplete and a one click <b>Run</b> button for VS Code.<br>
  Lightweight, written in TypeScript, no language server required.
</p>

<p align="center">
  <a href="#english">English</a> · <a href="#português">Português</a>
</p>

---

## English

### Features

- **Run button over `main`**: a `▶ Run` CodeLens appears above every top level `fun main`, and `▶ Run Script` on `.kts` files. Also available from the play button in the editor title bar and from the command palette (`Kotlin: Run Kotlin File`).
- **Clean output**: programs run in a dedicated `Kotlin Run` terminal that shows only what matters:

  ```text
  Compiling PlusMinus.kt...
  0.5
  0.3333333333333333
  0.16666666666666666

  Process finished with exit code 0 (2.4s)
  ```

  Programs can read from stdin (`readln()`), compiler errors are shown in red, and `Ctrl+C` stops a running program.
- **Syntax highlighting** for `.kt` and `.kts`: comments, KDoc, raw strings, string templates (`$name`, `${expr}`), all number formats, annotations, declarations, labels and operators.
- **Autocomplete**:
  - keywords and modifiers
  - snippets: `main`, `maina`, `fun`, `class`, `dataclass`, `enumclass`, `when`, `for`, `fori`, `try`, `printv` and more
  - common standard library functions and types (`println`, `listOf`, `mapOf`, `buildString`, `require`, ...)
  - functions, classes, properties, parameters and local variables declared in the current file
  - top level declarations from other Kotlin files in the workspace
  - no suggestions inside comments and strings (but they do work inside `${...}`)

### Requirements

To run code you need, on your `PATH` or configured in the settings:

- the Kotlin compiler, `kotlinc` ([installation guide](https://kotlinlang.org/docs/command-line.html); SDKMAN: `sdk install kotlin`)
- a JDK, `java` 8 or newer

Highlighting and autocomplete work without them.

### How it runs your code

| File | What happens |
|------|--------------|
| `.kt` with `main` | `kotlinc File.kt -include-runtime -d File.jar`, then `java -cp File.jar <package>.FileKt` |
| `.kts` script | `kotlinc -script File.kts` |

The file is saved before running. Compiled jars are kept in the extension's storage folder, not in your project.
Only single file programs are supported for now. Gradle and Maven projects are planned.

### Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `kotlin.run.kotlincPath` | `kotlinc` | Path to the Kotlin compiler. |
| `kotlin.run.javaPath` | `java` | Path to the java executable. |
| `kotlin.run.args` | `[]` | Arguments passed to `main`. |
| `kotlin.run.jvmArgs` | `[]` | Arguments passed to the JVM, e.g. `["-Xmx512m"]`. |
| `kotlin.run.clearTerminal` | `true` | Clear the `Kotlin Run` terminal before each run. |
| `kotlin.completion.workspaceIndex` | `true` | Offer top level declarations from other workspace files. |

### Contributing

```sh
git clone https://github.com/romulofer/run-kotlin-vscode.git
cd run-kotlin-vscode
npm install
npm run build              # bundle to dist/extension.js
npm test                   # unit and grammar tests
npm run test:integration   # tests inside VS Code (on headless Linux: xvfb-run -a npm run test:integration)
npm run package            # build the .vsix
```

Press `F5` in VS Code to open an Extension Development Host with the sample files in `test/fixtures`.
Design notes live in [docs/SPEC.md](docs/SPEC.md) and [docs/PLAN.md](docs/PLAN.md). Issues and pull requests are welcome.

### License

[MIT](LICENSE)

---

## Português

### Funcionalidades

- **Botão Run sobre a `main`**: um CodeLens `▶ Run` aparece acima de toda `fun main` de nível superior, e `▶ Run Script` em arquivos `.kts`. Também disponível pelo botão de play na barra de título do editor e pela paleta de comandos (`Kotlin: Run Kotlin File`).
- **Saída limpa**: os programas rodam em um terminal dedicado, `Kotlin Run`, que mostra só o que importa:

  ```text
  Compiling PlusMinus.kt...
  0.5
  0.3333333333333333
  0.16666666666666666

  Process finished with exit code 0 (2.4s)
  ```

  Os programas podem ler da entrada padrão (`readln()`), erros de compilação aparecem em vermelho e `Ctrl+C` interrompe um programa em execução.
- **Realce de sintaxe** para `.kt` e `.kts`: comentários, KDoc, strings brutas, templates de string (`$nome`, `${expr}`), todos os formatos numéricos, anotações, declarações, rótulos e operadores.
- **Autocompletar**:
  - palavras-chave e modificadores
  - snippets: `main`, `maina`, `fun`, `class`, `dataclass`, `enumclass`, `when`, `for`, `fori`, `try`, `printv` e outros
  - funções e tipos comuns da biblioteca padrão (`println`, `listOf`, `mapOf`, `buildString`, `require`, ...)
  - funções, classes, propriedades, parâmetros e variáveis locais declarados no arquivo atual
  - declarações de nível superior de outros arquivos Kotlin do workspace
  - nenhuma sugestão dentro de comentários e strings (mas funciona dentro de `${...}`)

### Requisitos

Para executar código você precisa ter, no `PATH` ou configurados nas opções:

- o compilador Kotlin, `kotlinc` ([guia de instalação](https://kotlinlang.org/docs/command-line.html); SDKMAN: `sdk install kotlin`)
- um JDK, `java` 8 ou mais recente

O realce de sintaxe e o autocompletar funcionam sem eles.

### Como o código é executado

| Arquivo | O que acontece |
|---------|----------------|
| `.kt` com `main` | `kotlinc Arquivo.kt -include-runtime -d Arquivo.jar`, depois `java -cp Arquivo.jar <pacote>.ArquivoKt` |
| script `.kts` | `kotlinc -script Arquivo.kts` |

O arquivo é salvo antes de executar. Os jars compilados ficam na pasta de armazenamento da extensão, não no seu projeto.
Por enquanto só programas de um único arquivo são suportados. Projetos Gradle e Maven estão planejados.

### Configurações

| Configuração | Padrão | Descrição |
|--------------|--------|-----------|
| `kotlin.run.kotlincPath` | `kotlinc` | Caminho do compilador Kotlin. |
| `kotlin.run.javaPath` | `java` | Caminho do executável java. |
| `kotlin.run.args` | `[]` | Argumentos passados para a `main`. |
| `kotlin.run.jvmArgs` | `[]` | Argumentos passados para a JVM, por exemplo `["-Xmx512m"]`. |
| `kotlin.run.clearTerminal` | `true` | Limpa o terminal `Kotlin Run` antes de cada execução. |
| `kotlin.completion.workspaceIndex` | `true` | Sugere declarações de nível superior de outros arquivos do workspace. |

### Contribuindo

```sh
git clone https://github.com/romulofer/run-kotlin-vscode.git
cd run-kotlin-vscode
npm install
npm run build              # gera dist/extension.js
npm test                   # testes unitários e de gramática
npm run test:integration   # testes dentro do VS Code (em Linux sem tela: xvfb-run -a npm run test:integration)
npm run package            # gera o .vsix
```

Pressione `F5` no VS Code para abrir um Extension Development Host com os arquivos de exemplo de `test/fixtures`.
As notas de design estão em [docs/SPEC.md](docs/SPEC.md) e [docs/PLAN.md](docs/PLAN.md). Issues e pull requests são bem-vindos.

### Licença

[MIT](LICENSE)
