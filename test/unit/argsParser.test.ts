import * as assert from "node:assert/strict";
import { formatArgs, parseArgs } from "../../src/core/argsParser";

describe("argsParser", () => {
  it("splits on whitespace", () => {
    assert.deepEqual(parseArgs("  a  b\tc "), { args: ["a", "b", "c"] });
    assert.deepEqual(parseArgs(""), { args: [] });
  });

  it("keeps quoted text together", () => {
    assert.deepEqual(parseArgs(`"a b" 'c d' e`), { args: ["a b", "c d", "e"] });
    assert.deepEqual(parseArgs(`a"b c"d`), { args: ["ab cd"] });
    assert.deepEqual(parseArgs(`"" x`), { args: ["", "x"] });
  });

  it("handles escapes", () => {
    assert.deepEqual(parseArgs(String.raw`a\ b "say \"hi\"" 'it\s'`), { args: ["a b", 'say "hi"', "it\\s"] });
    assert.deepEqual(parseArgs(String.raw`"back\\slash"`), { args: ["back\\slash"] });
  });

  it("reports an unterminated quote", () => {
    assert.match(parseArgs(`a "b`).error ?? "", /unterminated/i);
  });

  it("round trips through formatArgs", () => {
    const args = ["plain", "with space", 'q"uote', "", "it's"];
    assert.deepEqual(parseArgs(formatArgs(args)), { args });
  });
});
