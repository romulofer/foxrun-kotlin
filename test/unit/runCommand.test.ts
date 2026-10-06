import * as assert from "node:assert/strict";
import * as path from "node:path";
import { buildRunSteps, cacheKey, isScript, jarPathFor, quoteForCmd, RunSettings, staleJars } from "../../src/core/runCommand";

const settings: RunSettings = { kotlincPath: "/k/kotlinc", javaPath: "/j/java", args: [], jvmArgs: [] };

describe("runCommand", () => {
  it("detects scripts", () => {
    assert.equal(isScript("/a/b.kts"), true);
    assert.equal(isScript("/a/b.kt"), false);
  });

  it("builds a stable, file specific jar path", () => {
    const a = jarPathFor("/x/Main.kt", "/out");
    assert.equal(path.dirname(a), path.normalize("/out"));
    assert.match(path.basename(a), /^Main-[0-9a-f]{8}\.jar$/);
    assert.notEqual(a, jarPathFor("/y/Main.kt", "/out"));
    assert.equal(a, jarPathFor("/x/Main.kt", "/out"));
  });

  it("compiles to a jar and runs the main class", () => {
    const target = { filePath: "/src/my app.kt", mainClass: "com.x.My_appKt", outDir: "/out" };
    const jar = jarPathFor(target.filePath, target.outDir);
    const steps = buildRunSteps(target, { ...settings, args: ["a b"], jvmArgs: ["-Xmx256m"] });
    assert.deepEqual(steps, [
      { kind: "compile", command: "/k/kotlinc", args: ["/src/my app.kt", "-include-runtime", "-d", jar] },
      { kind: "run", command: "/j/java", args: ["-Xmx256m", "-cp", jar, "com.x.My_appKt", "a b"] },
    ]);
  });

  it("uses kotlinc -script for .kts files", () => {
    const steps = buildRunSteps({ filePath: "/src/build.kts", mainClass: "", outDir: "/out" }, { ...settings, args: ["x"] });
    assert.deepEqual(steps, [{ kind: "run", command: "/k/kotlinc", args: ["-script", "/src/build.kts", "x"] }]);
  });

  it("quotes arguments for cmd.exe", () => {
    assert.equal(quoteForCmd("C:\\plain\\x.kt"), "C:\\plain\\x.kt");
    assert.equal(quoteForCmd("C:\\a b\\x.kt"), "\"C:\\a b\\x.kt\"");
    assert.equal(quoteForCmd("say \"hi\""), "\"say \"\"hi\"\"\"");
  });
});

describe("runCommand cache and env", () => {
  const target = { filePath: "/src/Main.kt", mainClass: "MainKt", outDir: "/out" };

  it("derives a cache key from source and compiler", () => {
    const a = cacheKey("fun main() {}", "/k/kotlinc");
    assert.match(a, /^[0-9a-f]{8}$/);
    assert.equal(a, cacheKey("fun main() {}", "/k/kotlinc"));
    assert.notEqual(a, cacheKey("fun main() { }", "/k/kotlinc"));
    assert.notEqual(a, cacheKey("fun main() {}", "/other/kotlinc"));
  });

  it("puts the key in the jar name", () => {
    const plain = jarPathFor("/x/Main.kt", "/out");
    const keyed = jarPathFor("/x/Main.kt", "/out", "deadbeef");
    assert.equal(keyed, plain.replace(/\.jar$/, "-deadbeef.jar"));
  });

  it("skips the compile step when the build is cached", () => {
    const steps = buildRunSteps({ ...target, jarKey: "abc12345", skipCompile: true }, settings);
    const jar = jarPathFor(target.filePath, target.outDir, "abc12345");
    assert.deepEqual(steps, [
      { kind: "run", command: "/j/java", args: ["-cp", jar, "MainKt"], note: "Using cached build" },
    ]);
  });

  it("compiles to the keyed jar when there is no cache hit", () => {
    const steps = buildRunSteps({ ...target, jarKey: "abc12345" }, settings);
    const jar = jarPathFor(target.filePath, target.outDir, "abc12345");
    assert.equal(steps[0].kind, "compile");
    assert.deepEqual(steps[0].args.slice(-2), ["-d", jar]);
  });

  it("lists only stale jars of the same source", () => {
    const keep = path.basename(jarPathFor("/x/Main.kt", "/out", "bbbbbbbb"));
    const old = path.basename(jarPathFor("/x/Main.kt", "/out", "aaaaaaaa"));
    const other = path.basename(jarPathFor("/y/Main.kt", "/out", "aaaaaaaa"));
    assert.deepEqual(staleJars("/x/Main.kt", [keep, old, other, "notes.txt"], keep), [old]);
  });

  it("passes env to run steps only when set", () => {
    const withEnv = buildRunSteps({ ...target, jarKey: "k" }, { ...settings, env: { A: "1" } });
    assert.equal(withEnv[0].env, undefined);
    assert.deepEqual(withEnv[1].env, { A: "1" });
    const script = buildRunSteps({ filePath: "/s.kts", mainClass: "", outDir: "/out" }, { ...settings, env: { A: "1" } });
    assert.deepEqual(script[0].env, { A: "1" });
    assert.equal(buildRunSteps(target, { ...settings, env: {} })[1].env, undefined);
  });
});

describe("runCommand debugging", () => {
  const target = { filePath: "/src/Main.kt", mainClass: "MainKt", outDir: "/out", jarKey: "k" };

  it("starts the JVM suspended with a JDWP agent before the other JVM arguments", () => {
    const steps = buildRunSteps(target, { ...settings, jvmArgs: ["-Xmx64m"], debugPort: 5005 });
    const jar = jarPathFor(target.filePath, target.outDir, "k");
    assert.deepEqual(steps[1].args, [
      "-agentlib:jdwp=transport=dt_socket,server=y,suspend=y,address=127.0.0.1:5005",
      "-Xmx64m",
      "-cp",
      jar,
      "MainKt",
    ]);
  });

  it("does not add the agent when not debugging, and never for scripts", () => {
    assert.ok(!buildRunSteps(target, settings)[1].args.some((a) => a.includes("jdwp")));
    const script = buildRunSteps({ filePath: "/s.kts", mainClass: "", outDir: "/out" }, { ...settings, debugPort: 5005 });
    assert.ok(!script[0].args.some((a) => a.includes("jdwp")));
  });
});
