import * as assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import { findExecutable } from "../../src/core/executable";
import type { RunStep } from "../../src/core/runCommand";
import type { KotlinExtensionApi } from "../../src/extension";
import type { DebugHost } from "../../src/commands/debug";
import type { CommandRunner, RunObserver } from "../../src/terminal/runTerminal";

const EXTENSION_ID = "LegendaryRedfox.foxrun-kotlin";

function fixture(name: string): vscode.Uri {
  const folder = vscode.workspace.workspaceFolders?.[0];
  assert.ok(folder, "tests must run with the fixtures folder open");
  return vscode.Uri.joinPath(folder.uri, name);
}

async function open(name: string): Promise<vscode.TextDocument> {
  const document = await vscode.workspace.openTextDocument(fixture(name));
  await vscode.window.showTextDocument(document);
  return document;
}

async function api(): Promise<KotlinExtensionApi> {
  const extension = vscode.extensions.getExtension<KotlinExtensionApi>(EXTENSION_ID);
  assert.ok(extension, `extension ${EXTENSION_ID} not found`);
  return extension.activate();
}

async function completionLabels(document: vscode.TextDocument, position: vscode.Position): Promise<string[]> {
  const list = await vscode.commands.executeCommand<vscode.CompletionList>(
    "vscode.executeCompletionItemProvider",
    document.uri,
    position,
  );
  return list.items.map((i) => (typeof i.label === "string" ? i.label : i.label.label));
}

async function until<T>(probe: () => Promise<T | undefined>, timeoutMs = 10000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await probe();
    if (value !== undefined) return value;
    if (Date.now() > deadline) throw new Error("condition not met in time");
    await new Promise((r) => setTimeout(r, 100));
  }
}

class RecordingRunner implements CommandRunner {
  readonly calls: { steps: RunStep[]; cwd: string; fileName: string }[] = [];
  /** Lets a test play the part of the running program. */
  onRun?: (steps: RunStep[], observer: RunObserver | undefined) => void;
  run(steps: RunStep[], cwd: string, fileName: string, _clear?: boolean, observer?: RunObserver): void {
    this.calls.push({ steps, cwd, fileName });
    this.onRun?.(steps, observer);
  }
}

describe("Foxrun for Kotlin extension", () => {
  before(async () => {
    await api();
  });

  describe("language", () => {
    it("assigns the kotlin language to .kt and .kts files", async () => {
      assert.equal((await open("hello.kt")).languageId, "kotlin");
      assert.equal((await open("script.kts")).languageId, "kotlin");
    });
  });

  describe("CodeLens", () => {
    const runLenses = async (name: string) => {
      const document = await open(name);
      const lenses = await vscode.commands.executeCommand<vscode.CodeLens[]>(
        "vscode.executeCodeLensProvider",
        document.uri,
        100,
      );
      return lenses.filter((l) => l.command?.command === "kotlin.run");
    };

    it("shows Run above main", async () => {
      const lenses = await runLenses("hello.kt");
      assert.equal(lenses.length, 1);
      assert.equal(lenses[0].range.start.line, 4);
      assert.match(lenses[0].command!.title, /Run/);
    });

    it("shows Debug next to Run, but not on scripts", async () => {
      const debugLenses = async (name: string) => {
        const document = await open(name);
        const lenses = await vscode.commands.executeCommand<vscode.CodeLens[]>("vscode.executeCodeLensProvider", document.uri, 100);
        return lenses.filter((l) => l.command?.command === "kotlin.debug");
      };
      const lenses = await debugLenses("hello.kt");
      assert.equal(lenses.length, 1);
      assert.equal(lenses[0].range.start.line, 4);
      assert.equal((await debugLenses("script.kts")).length, 0);
    });

    it("shows nothing in a file without main", async () => {
      assert.equal((await runLenses("lib.kt")).length, 0);
    });

    it("shows Run Script on scripts", async () => {
      const lenses = await runLenses("script.kts");
      assert.equal(lenses.length, 1);
      assert.match(lenses[0].command!.title, /Run Script/);
    });
  });

  describe("completion", () => {
    it("offers keywords, snippets, stdlib and document symbols", async () => {
      const document = await open("hello.kt");
      const labels = await completionLabels(document, new vscode.Position(6, 4));
      for (const label of ["println", "fun", "main", "greeting", "who", "listOf"]) {
        assert.ok(labels.includes(label), `missing ${label}`);
      }
    });

    it("offers top level declarations from other workspace files", async () => {
      const document = await open("hello.kt");
      await until(async () => {
        const labels = await completionLabels(document, new vscode.Position(6, 4));
        return labels.includes("sharedHelper") && labels.includes("SharedThing") ? true : undefined;
      });
    });

    it("offers nothing inside comments", async () => {
      const document = await vscode.workspace.openTextDocument({ language: "kotlin", content: "// pri" });
      const list = await vscode.commands.executeCommand<vscode.CompletionList>(
        "vscode.executeCompletionItemProvider",
        document.uri,
        new vscode.Position(0, 6),
      );
      // Editor word based suggestions (kind Text) may still appear; ours must not.
      assert.deepEqual(list.items.filter((i) => i.kind !== vscode.CompletionItemKind.Text), []);
    });
  });

  describe("member completion", () => {
    async function labelsAfter(marker: string): Promise<string[]> {
      const document = await open("members.kt");
      const offset = document.getText().indexOf(marker) + marker.length;
      return completionLabels(document, document.positionAt(offset));
    }

    it("offers members of a class declared in the file", async () => {
      const labels = await labelsAfter("    p.");
      for (const name of ["name", "greet", "toString"]) assert.ok(labels.includes(name), `${name} missing`);
      assert.equal(labels.includes("println"), false);
    });

    it("offers String members after a string literal", async () => {
      const labels = await labelsAfter('"abc".');
      for (const name of ["length", "uppercase", "substring"]) assert.ok(labels.includes(name), `${name} missing`);
    });

    it("offers List members after a listOf call", async () => {
      const labels = await labelsAfter("listOf(1).");
      for (const name of ["map", "filter", "size"]) assert.ok(labels.includes(name), `${name} missing`);
    });
  });

  describe("kotlin.run", function () {
    if (process.platform === "win32") return;

    let runner: RecordingRunner;
    let toolsDir: string;
    const config = () => vscode.workspace.getConfiguration("kotlin.run");

    before(async () => {
      // Fake tools keep this suite independent of a local Kotlin install.
      toolsDir = fs.mkdtempSync(path.join(os.tmpdir(), "run-kotlin-tools-"));
      for (const tool of ["kotlinc", "java"]) {
        fs.writeFileSync(path.join(toolsDir, tool), "#!/bin/sh\n", { mode: 0o755 });
      }
      await config().update("kotlincPath", path.join(toolsDir, "kotlinc"), vscode.ConfigurationTarget.Global);
      await config().update("javaPath", path.join(toolsDir, "java"), vscode.ConfigurationTarget.Global);
      await config().update("args", ["one", "two words"], vscode.ConfigurationTarget.Global);
    });

    after(async () => {
      for (const key of ["kotlincPath", "javaPath", "args"]) {
        await config().update(key, undefined, vscode.ConfigurationTarget.Global);
      }
      (await api()).setRunner(undefined);
      fs.rmSync(toolsDir, { recursive: true, force: true });
    });

    beforeEach(async () => {
      runner = new RecordingRunner();
      (await api()).setRunner(runner);
    });

    it("compiles to a jar and runs the file facade class", async () => {
      const uri = fixture("hello.kt");
      const steps = await vscode.commands.executeCommand<RunStep[] | undefined>("kotlin.run", uri);
      assert.equal(runner.calls.length, 1);
      assert.deepEqual(runner.calls[0].steps, steps);
      assert.equal(runner.calls[0].cwd, path.dirname(uri.fsPath));
      assert.equal(runner.calls[0].fileName, uri.fsPath);
      const [compile, run] = steps!;
      assert.equal(compile.command, path.join(toolsDir, "kotlinc"));
      assert.deepEqual(compile.args.slice(0, 3), [uri.fsPath, "-include-runtime", "-d"]);
      const jar = compile.args[3];
      assert.match(jar, /hello-[0-9a-f]{8}-[0-9a-f]{8}\.jar$/);
      assert.equal(run.command, path.join(toolsDir, "java"));
      assert.deepEqual(run.args, ["-cp", jar, "demo.HelloKt", "one", "two words"]);
    });

    it("skips compiling when the jar for this source already exists", async () => {
      const first = (await vscode.commands.executeCommand<RunStep[]>("kotlin.run", fixture("hello.kt")))!;
      const jar = first[0].args[3];
      fs.mkdirSync(path.dirname(jar), { recursive: true });
      const stale = jar.replace(/-[0-9a-f]{8}\.jar$/, "-00000000.jar");
      fs.writeFileSync(jar, "");
      fs.writeFileSync(stale, "");
      try {
        const second = (await vscode.commands.executeCommand<RunStep[]>("kotlin.run", fixture("hello.kt")))!;
        assert.equal(second.length, 1);
        assert.equal(second[0].kind, "run");
        assert.equal(second[0].note, "Using cached build");
        assert.equal(fs.existsSync(stale), false, "stale jar should be pruned");

        await config().update("useCache", false, vscode.ConfigurationTarget.Global);
        const third = (await vscode.commands.executeCommand<RunStep[]>("kotlin.run", fixture("hello.kt")))!;
        assert.deepEqual(third.map((x) => x.kind), ["compile", "run"]);
      } finally {
        await config().update("useCache", undefined, vscode.ConfigurationTarget.Global);
        fs.rmSync(jar, { force: true });
        fs.rmSync(stale, { force: true });
      }
    });

    it("clears the build cache", async () => {
      const first = (await vscode.commands.executeCommand<RunStep[]>("kotlin.run", fixture("hello.kt")))!;
      const jar = first[0].args[3];
      fs.mkdirSync(path.dirname(jar), { recursive: true });
      fs.writeFileSync(jar, "");
      await vscode.commands.executeCommand("kotlin.clearBuildCache");
      assert.equal(fs.existsSync(jar), false);
    });

    it("passes kotlin.run.env to the program", async () => {
      await config().update("env", { GREETING: "hi" }, vscode.ConfigurationTarget.Global);
      try {
        const steps = (await vscode.commands.executeCommand<RunStep[]>("kotlin.run", fixture("hello.kt")))!;
        assert.equal(steps[0].env, undefined);
        assert.deepEqual(steps[steps.length - 1].env, { GREETING: "hi" });
      } finally {
        await config().update("env", undefined, vscode.ConfigurationTarget.Global);
      }
    });

    describe("kotlin.debug", () => {
      const started: Record<string, unknown>[] = [];
      const host = (installed: boolean): DebugHost => ({
        isInstalled: (id) => installed && id === "vscjava.vscode-java-debug",
        startDebugging: async (_folder, config) => {
          started.push(config);
          return true;
        },
      });

      beforeEach(() => {
        started.length = 0;
      });
      afterEach(async () => (await api()).setDebugHost(undefined));

      it("starts the JVM suspended and attaches the Java debugger", async () => {
        runner.onRun = (steps, observer) => {
          const agent = steps[steps.length - 1].args[0];
          const port = /address=127\.0\.0\.1:(\d+)/.exec(agent)?.[1];
          observer?.output?.(`Listening for transport dt_socket at address: ${port}\n`);
        };
        (await api()).setDebugHost(host(true));
        const steps = await vscode.commands.executeCommand<RunStep[] | undefined>("kotlin.debug", fixture("hello.kt"));
        assert.ok(steps, "debug should run the file");
        const agent = steps[steps.length - 1].args[0];
        assert.match(agent, /^-agentlib:jdwp=transport=dt_socket,server=y,suspend=y,address=127\.0\.0\.1:\d+$/);
        assert.equal(started.length, 1);
        assert.equal(started[0].type, "java");
        assert.equal(started[0].request, "attach");
        assert.equal(started[0].port, Number(/:(\d+)$/.exec(agent)![1]));
      });

      it("does not run anything when no Java debugger is installed", async () => {
        (await api()).setDebugHost(host(false));
        const steps = await vscode.commands.executeCommand<RunStep[] | undefined>("kotlin.debug", fixture("hello.kt"));
        assert.equal(steps, undefined);
        assert.equal(runner.calls.length, 0);
      });

      it("refuses scripts", async () => {
        (await api()).setDebugHost(host(true));
        const steps = await vscode.commands.executeCommand<RunStep[] | undefined>("kotlin.debug", fixture("script.kts"));
        assert.equal(steps, undefined);
        assert.equal(runner.calls.length, 0);
      });

      it("does not attach when the program ends before listening", async () => {
        runner.onRun = (_steps, observer) => observer?.exit?.(1);
        (await api()).setDebugHost(host(true));
        await vscode.commands.executeCommand("kotlin.debug", fixture("hello.kt"));
        assert.equal(started.length, 0);
      });
    });

    it("reports the resolved tools in Check Setup", async () => {
      const lines = (await vscode.commands.executeCommand<string[]>("kotlin.checkSetup"))!;
      assert.equal(lines.length, 2);
      assert.match(lines[0], new RegExp(`^kotlinc: .* at ${path.join(toolsDir, "kotlinc").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
      assert.match(lines[1], /^java: /);
      await config().update("javaPath", path.join(toolsDir, "missing-java"), vscode.ConfigurationTarget.Global);
      try {
        const broken = (await vscode.commands.executeCommand<string[]>("kotlin.checkSetup"))!;
        assert.match(broken[1], /^java: not found/);
      } finally {
        await config().update("javaPath", path.join(toolsDir, "java"), vscode.ConfigurationTarget.Global);
      }
    });

    it("runs the active editor when no uri is given", async () => {
      await open("hello.kt");
      await vscode.commands.executeCommand("kotlin.run");
      assert.equal(runner.calls.length, 1);
    });

    it("runs scripts with kotlinc -script", async () => {
      const steps = await vscode.commands.executeCommand<RunStep[] | undefined>("kotlin.run", fixture("script.kts"));
      assert.deepEqual(steps, [
        { kind: "run", command: path.join(toolsDir, "kotlinc"), args: ["-script", fixture("script.kts").fsPath, "one", "two words"] },
      ]);
    });

    it("refuses files without main", async () => {
      const steps = await vscode.commands.executeCommand<RunStep[] | undefined>("kotlin.run", fixture("lib.kt"));
      assert.equal(steps, undefined);
      assert.equal(runner.calls.length, 0);
    });

    it("opens the Kotlin Run terminal with the default runner", async () => {
      (await api()).setRunner(undefined);
      await vscode.commands.executeCommand("kotlin.run", fixture("hello.kt"));
      const terminal = await until(async () => vscode.window.terminals.find((t) => t.name === "Kotlin Run"));
      assert.ok(terminal.creationOptions && "pty" in terminal.creationOptions, "expected an extension terminal");
      terminal.dispose();
    });

    it("refuses when kotlinc cannot be found", async () => {
      await config().update("kotlincPath", path.join(toolsDir, "missing-kotlinc"), vscode.ConfigurationTarget.Global);
      try {
        const steps = await vscode.commands.executeCommand<RunStep[] | undefined>("kotlin.run", fixture("hello.kt"));
        assert.equal(steps, undefined);
        assert.equal(runner.calls.length, 0);
      } finally {
        await config().update("kotlincPath", path.join(toolsDir, "kotlinc"), vscode.ConfigurationTarget.Global);
      }
    });
  });

  describe("end to end with a real compiler", function () {
    this.timeout(180000);
    const hasKotlin = process.platform !== "win32" && !!findExecutable("kotlinc", process.env, process.platform) && !!findExecutable("java", process.env, process.platform);

    after(async () => (await api()).setRunner(undefined));

    (hasKotlin ? it : it.skip)("shows compiler errors in the Problems panel", async () => {
      const uri = fixture("broken.kt");
      await vscode.commands.executeCommand("kotlin.run", uri);
      const diagnostics = await until(async () => {
        const found = vscode.languages.getDiagnostics(uri);
        return found.length > 0 ? found : undefined;
      }, 120000);
      const error = diagnostics.find((d) => d.severity === vscode.DiagnosticSeverity.Error);
      assert.ok(error, "expected an error diagnostic");
      assert.match(error.message, /type mismatch/);
      assert.equal(error.range.start.line, 1);
      assert.equal(error.range.start.character, 17);
      assert.equal(error.source, "kotlinc");
      vscode.window.terminals.find((t) => t.name === "Kotlin Run")?.dispose();
    });

    (hasKotlin ? it : it.skip)("compiles and runs hello.kt", async () => {
      let output = "";
      (await api()).setRunner({
        run(steps, cwd) {
          for (const step of steps) {
            output = execFileSync(step.command, step.args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
          }
        },
      });
      await vscode.commands.executeCommand("kotlin.run", fixture("hello.kt"));
      assert.equal(output.trim(), "Hello, Kotlin");
    });
  });
});
