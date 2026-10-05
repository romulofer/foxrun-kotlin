import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { findExecutable } from "../../src/core/executable";

describe("findExecutable", function () {
  if (process.platform === "win32") {
    it.skip("posix only tests");
    return;
  }

  let dir: string;

  before(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "run-kotlin-"));
    fs.writeFileSync(path.join(dir, "kotlinc"), "#!/bin/sh\n", { mode: 0o755 });
    fs.writeFileSync(path.join(dir, "notexec"), "", { mode: 0o644 });
  });

  after(() => fs.rmSync(dir, { recursive: true, force: true }));

  it("finds a command on PATH", () => {
    assert.equal(findExecutable("kotlinc", { PATH: `/nonexistent:${dir}` }, "linux"), path.join(dir, "kotlinc"));
  });

  it("returns undefined for missing or non executable commands", () => {
    assert.equal(findExecutable("missing", { PATH: dir }, "linux"), undefined);
    assert.equal(findExecutable("notexec", { PATH: dir }, "linux"), undefined);
  });

  it("checks explicit paths directly", () => {
    assert.equal(findExecutable(path.join(dir, "kotlinc"), { PATH: "" }, "linux"), path.join(dir, "kotlinc"));
    assert.equal(findExecutable(path.join(dir, "nope"), { PATH: "" }, "linux"), undefined);
  });
});
