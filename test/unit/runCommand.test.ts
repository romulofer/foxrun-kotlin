import * as assert from "node:assert/strict";
import * as path from "node:path";
import { buildRunCommand, isScript, jarPathFor, quote, RunSettings, shellKindFor } from "../../src/core/runCommand";

const settings: RunSettings = { kotlincPath: "kotlinc", javaPath: "java", args: [], jvmArgs: [] };

describe("runCommand", () => {
  it("detects scripts", () => {
    assert.equal(isScript("/a/b.kts"), true);
    assert.equal(isScript("/a/b.kt"), false);
  });

  it("builds a stable, file specific jar path", () => {
    const a = jarPathFor("/x/Main.kt", "/out");
    const b = jarPathFor("/y/Main.kt", "/out");
    assert.equal(path.dirname(a), path.normalize("/out"));
    assert.match(path.basename(a), /^Main-[0-9a-f]{8}\.jar$/);
    assert.notEqual(a, b);
    assert.equal(a, jarPathFor("/x/Main.kt", "/out"));
  });

  it("quotes for posix shells", () => {
    assert.equal(quote("/plain/path.kt", "posix"), "/plain/path.kt");
    assert.equal(quote("/with space/a.kt", "posix"), "'/with space/a.kt'");
    assert.equal(quote("it's", "posix"), "'it'\\''s'");
  });

  it("quotes for powershell and cmd", () => {
    assert.equal(quote("C:\\a b\\x.kt", "powershell"), "'C:\\a b\\x.kt'");
    assert.equal(quote("it's", "powershell"), "'it''s'");
    assert.equal(quote("C:\\a b\\x.kt", "cmd"), "\"C:\\a b\\x.kt\"");
  });

  it("picks the shell kind from the shell path", () => {
    assert.equal(shellKindFor("/bin/zsh", "linux"), "posix");
    assert.equal(shellKindFor("C:\\Program Files\\PowerShell\\7\\pwsh.exe", "win32"), "powershell");
    assert.equal(shellKindFor("C:\\Windows\\System32\\cmd.exe", "win32"), "cmd");
    assert.equal(shellKindFor(undefined, "win32"), "powershell");
    assert.equal(shellKindFor(undefined, "linux"), "posix");
  });

  it("compiles to a jar and runs the main class", () => {
    const target = { filePath: "/src/app.kt", mainClass: "com.x.AppKt", outDir: "/out" };
    const jar = jarPathFor(target.filePath, target.outDir);
    const cmd = buildRunCommand(target, { ...settings, args: ["a b"], jvmArgs: ["-Xmx256m"] }, "posix");
    assert.equal(cmd, `kotlinc /src/app.kt -include-runtime -d ${jar} && java -Xmx256m -cp ${jar} com.x.AppKt 'a b'`);
  });

  it("uses kotlinc -script for .kts files", () => {
    const target = { filePath: "/src/build me.kts", mainClass: "", outDir: "/out" };
    assert.equal(buildRunCommand(target, { ...settings, args: ["x"] }, "posix"), "kotlinc -script '/src/build me.kts' x");
  });

  it("chains with if ($?) and the call operator in powershell", () => {
    const target = { filePath: "C:\\src\\app.kt", mainClass: "AppKt", outDir: "C:\\out" };
    const cmd = buildRunCommand(target, { ...settings, kotlincPath: "C:\\Kotlin Home\\kotlinc.bat" }, "powershell");
    assert.match(cmd, /^& 'C:\\Kotlin Home\\kotlinc\.bat' C:\\src\\app\.kt -include-runtime -d \S+; if \(\$\?\) \{ java -cp \S+ AppKt \}$/);
  });
});
