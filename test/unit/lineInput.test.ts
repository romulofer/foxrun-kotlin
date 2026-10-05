import * as assert from "node:assert/strict";
import { LineInput } from "../../src/core/lineInput";

const ch = (code: number) => String.fromCharCode(code);
const BACKSPACE = ch(8);
const DELETE = ch(127);
const ESC = ch(27);

describe("LineInput", () => {
  it("echoes characters and emits a line on Enter", () => {
    const input = new LineInput();
    assert.deepEqual(input.feed("ab"), { echo: "ab", lines: [], interrupt: false, endOfInput: false });
    assert.deepEqual(input.feed("c\r"), { echo: "c\r\n", lines: ["abc"], interrupt: false, endOfInput: false });
  });

  it("handles backspace", () => {
    const input = new LineInput();
    const r = input.feed(`abc${DELETE}${BACKSPACE}d\r`);
    assert.deepEqual(r.lines, ["ad"]);
    assert.equal(r.echo, `abc${BACKSPACE} ${BACKSPACE}${BACKSPACE} ${BACKSPACE}d\r\n`);
    assert.equal(input.feed(DELETE).echo, "");
  });

  it("splits pasted text into lines and treats CRLF as one newline", () => {
    assert.deepEqual(new LineInput().feed("1\r\n2\n3\r").lines, ["1", "2", "3"]);
  });

  it("ignores escape sequences such as arrow keys", () => {
    assert.deepEqual(new LineInput().feed(`a${ESC}[A${ESC}[1;5Cb\r`).lines, ["ab"]);
  });

  it("reports Ctrl+C and Ctrl+D", () => {
    const input = new LineInput();
    assert.equal(input.feed(`x${ch(3)}`).interrupt, true);
    const r = input.feed(`y${ch(4)}`);
    assert.equal(r.endOfInput, true);
    assert.deepEqual(r.lines, ["y"]);
  });
});
