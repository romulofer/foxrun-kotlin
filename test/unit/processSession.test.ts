import * as assert from "node:assert/strict";
import { OutputKind, ProcessSession } from "../../src/core/processSession";
import { RunStep } from "../../src/core/runCommand";

interface Captured {
  text: string;
  kinds: Set<OutputKind>;
  code: number | null;
}

function run(steps: RunStep[], onStart?: (s: ProcessSession) => void): Promise<Captured> {
  return new Promise((resolve) => {
    const captured: Captured = { text: "", kinds: new Set(), code: null };
    const session = new ProcessSession(steps, process.cwd(), "/src/Demo.kt", {
      output(text, kind) {
        captured.text += text;
        captured.kinds.add(kind);
      },
      exit(code) {
        captured.code = code;
        resolve(captured);
      },
    }).start();
    onStart?.(session);
  });
}

const node = (kind: RunStep["kind"], script: string): RunStep => ({ kind, command: process.execPath, args: ["-e", script] });

describe("ProcessSession", () => {
  it("runs steps in order and prints only program output plus status lines", async () => {
    const r = await run([node("compile", ""), node("run", "console.log('hello')")]);
    assert.equal(r.code, 0);
    assert.match(r.text, /^Compiling Demo\.kt\.\.\.\nhello\n\nProcess finished with exit code 0 \(\d+\.\ds\)\n$/);
  });

  it("stops after a failed compile", async () => {
    const r = await run([node("compile", "console.error('e: boom'); process.exit(1)"), node("run", "console.log('never')")]);
    assert.equal(r.code, 1);
    assert.match(r.text, /e: boom/);
    assert.match(r.text, /Compilation failed with exit code 1/);
    assert.doesNotMatch(r.text, /never/);
    assert.ok(r.kinds.has("stderr"));
  });

  it("reports a non zero program exit code", async () => {
    const r = await run([node("run", "process.exit(3)")]);
    assert.equal(r.code, 3);
    assert.match(r.text, /Process finished with exit code 3/);
  });

  it("forwards stdin to the program", async () => {
    const r = await run([node("run", "process.stdin.on('data', d => { console.log('got ' + d.toString().trim()); process.exit(0) })")], (s) => {
      s.write("42\n");
    });
    assert.match(r.text, /got 42/);
  });

  it("can be killed", async () => {
    const r = await run([node("run", "setInterval(() => {}, 1000)")], (s) => setTimeout(() => s.kill(), 100));
    assert.match(r.text, /Process stopped/);
  });

  it("reports commands that cannot be started", async () => {
    const r = await run([{ kind: "run", command: "/definitely/missing/java", args: [] }]);
    assert.match(r.text, /Failed to start \/definitely\/missing\/java/);
    assert.equal(r.code, null);
  });
});

describe("ProcessSession notes and env", () => {
  it("prints a step note before the step output", async () => {
    const step: RunStep = { ...node("run", "console.log('out')"), note: "Using cached build" };
    const r = await run([step]);
    assert.match(r.text, /^Using cached build\nout\n/);
  });

  it("merges step env over the process env", async () => {
    const step: RunStep = { ...node("run", "console.log(process.env.FOXRUN_T + ':' + typeof process.env.PATH)"), env: { FOXRUN_T: "yes" } };
    const r = await run([step]);
    assert.match(r.text, /^yes:string\n/);
  });
});

describe("ProcessSession compile output", () => {
  function runWithCompiled(steps: RunStep[]): Promise<{ output: string; code: number | null }[]> {
    return new Promise((resolve) => {
      const calls: { output: string; code: number | null }[] = [];
      new ProcessSession(steps, process.cwd(), "/src/Demo.kt", {
        output() {},
        exit() {
          resolve(calls);
        },
        compiled(output, code) {
          calls.push({ output, code });
        },
      }).start();
    });
  }

  it("reports compile output once, for failed compiles", async () => {
    const calls = await runWithCompiled([node("compile", "console.error('A.kt:1:1: error: boom'); process.exit(1)")]);
    assert.deepEqual(calls, [{ output: "A.kt:1:1: error: boom\n", code: 1 }]);
  });

  it("reports warnings of successful compiles and never run output", async () => {
    const calls = await runWithCompiled([node("compile", "console.error('warn')"), node("run", "console.log('program')")]);
    assert.deepEqual(calls, [{ output: "warn\n", code: 0 }]);
  });
});
