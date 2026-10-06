import * as assert from "node:assert/strict";
import { findLocationLinks, parseKotlincOutput } from "../../src/core/kotlincDiagnostics";

const OUTPUT = [
  "/p/Bad.kt:6:1: error: expecting an expression",
  "}",
  "^",
  "/p/Bad.kt:2:18: error: type mismatch: inferred type is String but Int was expected",
  '    val x: Int = "text"',
  "                 ^",
  "/p/Bad.kt:2:9: warning: variable 'x' is never used",
  "    val x: Int = \"text\"",
  "        ^",
  "",
].join("\n");

describe("kotlincDiagnostics", () => {
  it("parses errors and warnings with positions", () => {
    assert.deepEqual(parseKotlincOutput(OUTPUT), [
      { file: "/p/Bad.kt", line: 6, column: 1, severity: "error", message: "expecting an expression" },
      { file: "/p/Bad.kt", line: 2, column: 18, severity: "error", message: "type mismatch: inferred type is String but Int was expected" },
      { file: "/p/Bad.kt", line: 2, column: 9, severity: "warning", message: "variable 'x' is never used" },
    ]);
  });

  it("ignores excerpts, status lines and messages without a location", () => {
    const text = "info: kotlinc-jvm 2.0.0\nerror: source file or directory not found: x.kt\n    foo(bar)\n    ^\n";
    assert.deepEqual(parseKotlincOutput(text), []);
  });

  it("handles Windows paths, CRLF and a missing column", () => {
    const text = "C:\\src\\Main.kt:3:7: error: unresolved reference: q\r\nC:\\src\\Main.kt:9: warning: deprecated\r\n";
    assert.deepEqual(parseKotlincOutput(text), [
      { file: "C:\\src\\Main.kt", line: 3, column: 7, severity: "error", message: "unresolved reference: q" },
      { file: "C:\\src\\Main.kt", line: 9, column: 1, severity: "warning", message: "deprecated" },
    ]);
  });

  it("treats exception lines as errors and drops duplicates", () => {
    const text = "/a.kt:1:1: exception: boom\n/a.kt:1:1: exception: boom\n";
    assert.deepEqual(parseKotlincOutput(text), [{ file: "/a.kt", line: 1, column: 1, severity: "error", message: "boom" }]);
  });

  it("finds file:line:col links in a terminal line", () => {
    const line = "/p/Bad.kt:2:18: error: type mismatch";
    assert.deepEqual(findLocationLinks(line), [{ startIndex: 0, length: "/p/Bad.kt:2:18".length, file: "/p/Bad.kt", line: 2, column: 18 }]);
    assert.deepEqual(findLocationLinks("at C:\\a\\B.kt:7 (x)"), [{ startIndex: 3, length: "C:\\a\\B.kt:7".length, file: "C:\\a\\B.kt", line: 7, column: 1 }]);
    assert.deepEqual(findLocationLinks("no links 12:30 here"), []);
  });
});
