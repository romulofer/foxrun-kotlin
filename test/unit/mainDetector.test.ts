import * as assert from "node:assert/strict";
import { analyzeFile, facadeClassName, fileFacadeShortName, findMainFunctions } from "../../src/core/mainDetector";

describe("findMainFunctions", () => {
  it("finds a main without parameters", () => {
    const mains = findMainFunctions(`package a\n\nfun main() {\n  println("hi")\n}\n`);
    assert.deepEqual(mains, [{ line: 2, character: 0, hasArgs: false }]);
  });

  it("finds main with Array<String> args", () => {
    const mains = findMainFunctions("fun main(args: Array<String>) {}");
    assert.equal(mains.length, 1);
    assert.equal(mains[0].hasArgs, true);
  });

  it("finds main with vararg String args", () => {
    assert.equal(findMainFunctions("fun main(vararg args: String) {}").length, 1);
  });

  it("finds suspend main and expression body main", () => {
    assert.equal(findMainFunctions("suspend fun main() = coroutineScope { }").length, 1);
  });

  it("reports the column of the fun keyword", () => {
    assert.deepEqual(findMainFunctions("public fun main() {}")[0], { line: 0, character: 7, hasArgs: false });
  });

  it("ignores main with other parameters", () => {
    assert.equal(findMainFunctions("fun main(x: Int) {}").length, 0);
  });

  it("ignores main nested in a class or function", () => {
    assert.equal(findMainFunctions("class A {\n  fun main() {}\n}\nfun f() { fun main() {} }").length, 0);
  });

  it("ignores extension functions named main", () => {
    assert.equal(findMainFunctions("fun String.main() {}").length, 0);
  });

  it("ignores main in comments and strings", () => {
    assert.equal(findMainFunctions(`// fun main() {}\n/* fun main() {} */\nval s = "fun main() {}"`).length, 0);
  });

  it("is not confused by braces in strings", () => {
    assert.equal(findMainFunctions(`val s = "{"\nfun main() {}`).length, 1);
  });
});

describe("analyzeFile", () => {
  it("reads package and @file:JvmName", () => {
    const info = analyzeFile(`@file:JvmName("App")\npackage com.example.app\n\nfun main() {}`);
    assert.equal(info.packageName, "com.example.app");
    assert.equal(info.jvmName, "App");
    assert.equal(info.mains.length, 1);
  });
});

describe("facadeClassName", () => {
  it("derives the class name from the file name", () => {
    assert.equal(fileFacadeShortName("/x/y/hello.kt"), "HelloKt");
    assert.equal(fileFacadeShortName("Main.kt"), "MainKt");
    assert.equal(fileFacadeShortName("hello-world.kt"), "Hello_worldKt");
    assert.equal(fileFacadeShortName("1st.kt"), "_1stKt");
  });

  it("prefixes the package and honors JvmName", () => {
    assert.equal(facadeClassName("main.kt", { packageName: "a.b", jvmName: undefined }), "a.b.MainKt");
    assert.equal(facadeClassName("main.kt", { packageName: "a.b", jvmName: "App" }), "a.b.App");
    assert.equal(facadeClassName("main.kt", { packageName: undefined, jvmName: undefined }), "MainKt");
  });
});
