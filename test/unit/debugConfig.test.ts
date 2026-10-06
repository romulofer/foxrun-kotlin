import * as assert from "node:assert/strict";
import { attachConfig, DEBUGGERS, pickDebugger } from "../../src/core/debugConfig";

describe("debugConfig", () => {
  it("prefers the Java debugger from Microsoft, then Oracle's", () => {
    assert.equal(pickDebugger(() => true)?.type, "java");
    assert.equal(pickDebugger((id) => id === "oracle.oracle-java")?.type, "jdk");
    assert.equal(pickDebugger(() => false), undefined);
  });

  it("builds an attach configuration per debugger", () => {
    const java = attachConfig(DEBUGGERS[0], 5005, ["/src"]);
    assert.deepEqual(java, {
      type: "java",
      request: "attach",
      name: "Kotlin: attach to JVM",
      hostName: "127.0.0.1",
      port: 5005,
      sourcePaths: ["/src"],
    });
    const oracle = attachConfig(DEBUGGERS[1], 5005, ["/src"]);
    assert.equal(oracle.type, "jdk");
    assert.equal(oracle.port, "5005");
    assert.equal(oracle.hostName, "127.0.0.1");
  });
});
