import * as assert from "node:assert/strict";
import * as path from "node:path";
import { buildRunSteps, isScript, jarPathFor, quoteForCmd, RunSettings } from "../../src/core/runCommand";

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
