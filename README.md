<p align="center">
  <img src="images/icon.png" width="128" alt="Foxrun for Kotlin icon">
</p>

<h1 align="center">Foxrun for Kotlin</h1>

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
- **Debug button**: a `Debug` CodeLens next to `Run` starts the program suspended and attaches a Java debugger (see [Debugging](#debugging)).
- **Run with arguments**: `Kotlin: Run Kotlin File With Arguments...` asks for the arguments (with shell style quoting) and remembers them per file.
- **Fast reruns**: unchanged files are not compiled again, the build is reused (`Using cached build`).
- **Compiler errors in the Problems panel**: errors and warnings from `kotlinc` get squiggles at the right line and column, and `File.kt:12:5` in the terminal is clickable.
- **Clean output**: programs run in a dedicated `Kotlin Run` terminal that shows only what matters:

  ```text
  Compiling PlusMinus.kt...
  0.5
  0.3333333333333333
  0.16666666666666666

  Process finished with exit code 0 (2.4s)
  ```

  Programs can read from stdin (`readln()`), compiler errors are shown in red, and `Ctrl+C` stops a running program.
- **Syntax highlighting** for `.kt` and `.kts`: comments, KDoc (tags and `[links]`), raw strings, string templates (`$name`, `${expr}`, multi dollar `$$"..."`), all number formats, annotations, declarations (including `value class`, `fun interface`, `data object` and `context(...)` parameters), generics and type parameters, named arguments, lambda parameters, implicit `it`, labels and operators.
- **Autocomplete**:
  - members after a dot: `"abc".` offers `length`, `uppercase`, `substring`; `listOf(1).` offers `map`, `filter`, `size`; `person.` offers the members of `Person`. The receiver type comes from literals, declared types, constructor and factory calls and chained calls (`"a b".split(" ").`)
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

If they are not on `PATH`, `KOTLIN_HOME`, `JAVA_HOME`, SDKMAN and the usual Homebrew locations are tried. Run `Kotlin: Check Setup` to see what was found. Highlighting and autocomplete work without them.

### How it runs your code

| File | What happens |
|------|--------------|
| `.kt` with `main` | `kotlinc File.kt -include-runtime -d File.jar`, then `java -cp File.jar <package>.FileKt` |
| `.kts` script | `kotlinc -script File.kts` |

The file is saved before running. Compiled jars are kept in the extension's storage folder, not in your project, one per source version. `Kotlin: Clear Build Cache` empties it.
Only single file programs are supported for now. Gradle and Maven projects are planned.

### Debugging

The `Debug` CodeLens (and `Kotlin: Debug Kotlin File`) compiles the file, starts the JVM suspended with a JDWP agent in the `Kotlin Run` terminal and attaches the debugger once the JVM is listening. It needs one of these extensions installed:

- [Debugger for Java](https://marketplace.visualstudio.com/items?itemName=vscjava.vscode-java-debug) (`vscjava.vscode-java-debug`)
- Oracle Java Platform (`oracle.oracle-java`)

Set breakpoints in the `.kt` file before you start. Scripts (`.kts`) cannot be debugged. If you cancel or the debugger fails to attach, press `Ctrl+C` in the terminal to stop the waiting JVM.

### Commands

| Command | What it does |
|---------|--------------|
| `Kotlin: Run Kotlin File` | Compile and run the current file. |
| `Kotlin: Run Kotlin File With Arguments...` | Run with arguments you type, remembered per file. |
| `Kotlin: Debug Kotlin File` | Start the program suspended and attach a Java debugger. |
| `Kotlin: Check Setup` | Show where `kotlinc` and `java` were found and their versions. |
| `Kotlin: Clear Build Cache` | Delete the cached jars. |

### Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `kotlin.run.kotlincPath` | `kotlinc` | Path to the Kotlin compiler. |
| `kotlin.run.javaPath` | `java` | Path to the java executable. |
| `kotlin.run.args` | `[]` | Arguments passed to `main`. |
| `kotlin.run.jvmArgs` | `[]` | Arguments passed to the JVM, e.g. `["-Xmx512m"]`. |
| `kotlin.run.env` | `{}` | Environment variables added when the program runs, e.g. `{"MODE": "dev"}`. |
| `kotlin.run.useCache` | `true` | Skip compiling when the file and compiler have not changed. |
| `kotlin.run.showDiagnostics` | `true` | Show compiler errors and warnings in the Problems panel. |
| `kotlin.run.clearTerminal` | `true` | Clear the `Kotlin Run` terminal before each run. |
| `kotlin.completion.workspaceIndex` | `true` | Offer top level declarations and members from other workspace files. |

### Contributing

```sh
git clone https://github.com/romulofer/foxrun-kotlin.git
cd foxrun-kotlin
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

Kotlin and the Kotlin logo are trademarks of JetBrains s.r.o. This is a community project, not affiliated with or endorsed by JetBrains or the Kotlin Foundation.

---

## Português

### Funcionalidades

- **Botão Run sobre a `main`**: um CodeLens `▶ Run` aparece acima de toda `fun main` de nível superior, e `▶ Run Script` em arquivos `.kts`. Também disponível pelo botão de play na barra de título do editor e pela paleta de comandos (`Kotlin: Run Kotlin File`).
- **Botão Debug**: um CodeLens `Debug` ao lado de `Run` inicia o programa suspenso e conecta um depurador Java (veja [Depuração](#depuração)).
- **Executar com argumentos**: `Kotlin: Run Kotlin File With Arguments...` pergunta os argumentos (com aspas no estilo do shell) e lembra deles por arquivo.
- **Reexecuções rápidas**: arquivos sem alteração não são compilados de novo, o build é reaproveitado (`Using cached build`).
- **Erros do compilador no painel Problemas**: erros e avisos do `kotlinc` aparecem sublinhados na linha e coluna certas, e `Arquivo.kt:12:5` no terminal é clicável.
- **Saída limpa**: os programas rodam em um terminal dedicado, `Kotlin Run`, que mostra só o que importa:

  ```text
  Compiling PlusMinus.kt...
  0.5
  0.3333333333333333
  0.16666666666666666

  Process finished with exit code 0 (2.4s)
  ```

  Os programas podem ler da entrada padrão (`readln()`), erros de compilação aparecem em vermelho e `Ctrl+C` interrompe um programa em execução.
- **Realce de sintaxe** para `.kt` e `.kts`: comentários, KDoc (tags e `[links]`), strings brutas, templates de string (`$nome`, `${expr}`, multi dólar `$$"..."`), todos os formatos numéricos, anotações, declarações (incluindo `value class`, `fun interface`, `data object` e parâmetros `context(...)`), generics e parâmetros de tipo, argumentos nomeados, parâmetros de lambda, `it` implícito, rótulos e operadores.
- **Autocompletar**:
  - membros depois do ponto: `"abc".` sugere `length`, `uppercase`, `substring`; `listOf(1).` sugere `map`, `filter`, `size`; `pessoa.` sugere os membros de `Pessoa`. O tipo do receptor vem de literais, tipos declarados, chamadas de construtor e de funções de fábrica e chamadas encadeadas (`"a b".split(" ").`)
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

Se não estiverem no `PATH`, são procurados em `KOTLIN_HOME`, `JAVA_HOME`, SDKMAN e nos locais usuais do Homebrew. Rode `Kotlin: Check Setup` para ver o que foi encontrado. O realce de sintaxe e o autocompletar funcionam sem eles.

### Como o código é executado

| Arquivo | O que acontece |
|---------|----------------|
| `.kt` com `main` | `kotlinc Arquivo.kt -include-runtime -d Arquivo.jar`, depois `java -cp Arquivo.jar <pacote>.ArquivoKt` |
| script `.kts` | `kotlinc -script Arquivo.kts` |

O arquivo é salvo antes de executar. Os jars compilados ficam na pasta de armazenamento da extensão, não no seu projeto, um por versão do código. `Kotlin: Clear Build Cache` esvazia essa pasta.
Por enquanto só programas de um único arquivo são suportados. Projetos Gradle e Maven estão planejados.

### Depuração

O CodeLens `Debug` (e `Kotlin: Debug Kotlin File`) compila o arquivo, inicia a JVM suspensa com um agente JDWP no terminal `Kotlin Run` e conecta o depurador assim que a JVM estiver escutando. É preciso ter uma destas extensões instalada:

- [Debugger for Java](https://marketplace.visualstudio.com/items?itemName=vscjava.vscode-java-debug) (`vscjava.vscode-java-debug`)
- Oracle Java Platform (`oracle.oracle-java`)

Coloque os breakpoints no arquivo `.kt` antes de começar. Scripts (`.kts`) não podem ser depurados. Se você cancelar ou o depurador não conseguir conectar, pressione `Ctrl+C` no terminal para encerrar a JVM que ficou esperando.

### Comandos

| Comando | O que faz |
|---------|-----------|
| `Kotlin: Run Kotlin File` | Compila e executa o arquivo atual. |
| `Kotlin: Run Kotlin File With Arguments...` | Executa com argumentos digitados, lembrados por arquivo. |
| `Kotlin: Debug Kotlin File` | Inicia o programa suspenso e conecta um depurador Java. |
| `Kotlin: Check Setup` | Mostra onde `kotlinc` e `java` foram encontrados e suas versões. |
| `Kotlin: Clear Build Cache` | Apaga os jars em cache. |

### Configurações

| Configuração | Padrão | Descrição |
|--------------|--------|-----------|
| `kotlin.run.kotlincPath` | `kotlinc` | Caminho do compilador Kotlin. |
| `kotlin.run.javaPath` | `java` | Caminho do executável java. |
| `kotlin.run.args` | `[]` | Argumentos passados para a `main`. |
| `kotlin.run.jvmArgs` | `[]` | Argumentos passados para a JVM, por exemplo `["-Xmx512m"]`. |
| `kotlin.run.env` | `{}` | Variáveis de ambiente adicionadas ao executar o programa, por exemplo `{"MODE": "dev"}`. |
| `kotlin.run.useCache` | `true` | Não compila de novo quando o arquivo e o compilador não mudaram. |
| `kotlin.run.showDiagnostics` | `true` | Mostra erros e avisos do compilador no painel Problemas. |
| `kotlin.run.clearTerminal` | `true` | Limpa o terminal `Kotlin Run` antes de cada execução. |
| `kotlin.completion.workspaceIndex` | `true` | Sugere declarações de nível superior e membros de outros arquivos do workspace. |

### Contribuindo

```sh
git clone https://github.com/romulofer/foxrun-kotlin.git
cd foxrun-kotlin
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

Kotlin e o logo do Kotlin são marcas registradas da JetBrains s.r.o. Este é um projeto da comunidade, sem afiliação ou endosso da JetBrains ou da Kotlin Foundation.
