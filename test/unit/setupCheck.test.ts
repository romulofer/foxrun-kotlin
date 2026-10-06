import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fallbackDirs, installHelpUrl, parseVersion, resolveTool } from "../../src/core/setupCheck";

describe("setupCheck", () => {
  let home: string;
  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), "foxrun-home-"));
  });
  afterEach(() => fs.rmSync(home, { recursive: true, force: true }));

  function fakeTool(dir: string, name: string): string {
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, name);
    fs.writeFileSync(file, "#!/bin/sh\n", { mode: 0o755 });
    return file;
  }

  it("lists SDKMAN, KOTLIN_HOME and JAVA_HOME bins", () => {
    const dirs = fallbackDirs("kotlinc", { KOTLIN_HOME: "/opt/kotlin", JAVA_HOME: "/jdk" }, home, "linux");
    assert.ok(dirs.includes(path.posix.join("/opt/kotlin", "bin")));
    assert.ok(dirs.includes(path.join(home, ".sdkman", "candidates", "kotlin", "current", "bin")));
    assert.ok(!dirs.includes(path.posix.join("/jdk", "bin")), "JAVA_HOME is for java, not kotlinc");
    const javaDirs = fallbackDirs("java", { JAVA_HOME: "/jdk" }, home, "linux");
    assert.ok(javaDirs.includes(path.posix.join("/jdk", "bin")));
    assert.ok(javaDirs.includes(path.join(home, ".sdkman", "candidates", "java", "current", "bin")));
  });

  it("finds a tool outside PATH through the fallbacks", () => {
    const expected = fakeTool(path.join(home, ".sdkman", "candidates", "kotlin", "current", "bin"), "kotlinc");
    assert.equal(resolveTool("kotlinc", { PATH: "/nonexistent" }, home, "linux"), expected);
  });

  it("prefers PATH over the fallbacks", () => {
    fakeTool(path.join(home, ".sdkman", "candidates", "kotlin", "current", "bin"), "kotlinc");
    const onPath = fakeTool(path.join(home, "bin"), "kotlinc");
    assert.equal(resolveTool("kotlinc", { PATH: path.join(home, "bin") }, home, "linux"), onPath);
  });

  it("does not use fallbacks for custom paths", () => {
    fakeTool(path.join(home, ".sdkman", "candidates", "kotlin", "current", "bin"), "kotlinc");
    assert.equal(resolveTool(path.join(home, "missing", "kotlinc"), { PATH: "" }, home, "linux"), undefined);
  });

  it("returns undefined when nothing is found", () => {
    assert.equal(resolveTool("kotlinc", { PATH: "/nonexistent" }, home, "linux"), undefined);
  });

  it("parses kotlinc and java version output", () => {
    assert.equal(parseVersion("info: kotlinc-jvm 2.0.21 (JRE 21.0.4+7)\n"), "kotlinc-jvm 2.0.21");
    assert.equal(parseVersion('openjdk version "21.0.4" 2024-07-16\nOpenJDK Runtime Environment'), "openjdk 21.0.4");
    assert.equal(parseVersion('java version "1.8.0_402"'), "java 1.8.0_402");
    assert.equal(parseVersion("something else"), "unknown version");
  });

  it("points to install pages", () => {
    assert.match(installHelpUrl("kotlinc"), /^https:\/\/kotlinlang\.org\//);
    assert.match(installHelpUrl("java"), /^https:\/\//);
  });
});
