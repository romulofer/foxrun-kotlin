import * as assert from "node:assert/strict";
import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import type { CommandRunner } from "../../src/commands/run";
import { findExecutable } from "../../src/core/executable";
import type { KotlinExtensionApi } from "../../src/extension";

const EXTENSION_ID = "romulo-fernandes-evangelista.run-kotlin-vscode";

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
  readonly calls: { commandLine: string; cwd: string }[] = [];
  run(commandLine: string, cwd: string): void {
    this.calls.push({ commandLine, cwd });
  }
}

describe("Run Kotlin extension", () => {
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
      const commandLine = await vscode.commands.executeCommand<string | undefined>("kotlin.run", uri);
      assert.equal(runner.calls.length, 1);
      assert.equal(runner.calls[0].commandLine, commandLine);
      assert.equal(runner.calls[0].cwd, path.dirname(uri.fsPath));
      assert.match(commandLine!, /kotlinc .*hello\.kt -include-runtime -d \S+\.jar && \S*java -cp \S+\.jar demo\.HelloKt one 'two words'$/);
    });

    it("runs the active editor when no uri is given", async () => {
      await open("hello.kt");
      await vscode.commands.executeCommand("kotlin.run");
      assert.equal(runner.calls.length, 1);
    });

    it("runs scripts with kotlinc -script", async () => {
      const commandLine = await vscode.commands.executeCommand<string | undefined>("kotlin.run", fixture("script.kts"));
      assert.match(commandLine!, /kotlinc -script \S*script\.kts one 'two words'$/);
    });

    it("refuses files without main", async () => {
      const commandLine = await vscode.commands.executeCommand<string | undefined>("kotlin.run", fixture("lib.kt"));
      assert.equal(commandLine, undefined);
      assert.equal(runner.calls.length, 0);
    });

    it("refuses when kotlinc cannot be found", async () => {
      await config().update("kotlincPath", path.join(toolsDir, "missing-kotlinc"), vscode.ConfigurationTarget.Global);
      try {
        const commandLine = await vscode.commands.executeCommand<string | undefined>("kotlin.run", fixture("hello.kt"));
        assert.equal(commandLine, undefined);
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

    (hasKotlin ? it : it.skip)("compiles and runs hello.kt", async () => {
      let output = "";
      (await api()).setRunner({
        run(commandLine, cwd) {
          output = execSync(commandLine, { cwd, encoding: "utf8", shell: "/bin/sh", stdio: ["ignore", "pipe", "ignore"] });
        },
      });
      await vscode.commands.executeCommand("kotlin.run", fixture("hello.kt"));
      assert.equal(output.trim(), "Hello, Kotlin");
    });
  });
});
