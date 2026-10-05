const CTRL_C = String.fromCharCode(3);
const CTRL_D = String.fromCharCode(4);
const BACKSPACE = String.fromCharCode(8);
const DELETE = String.fromCharCode(127);
const ESC = String.fromCharCode(27);

export interface InputResult {
  /** Text to write back to the terminal so the user sees what they type. */
  echo: string;
  /** Completed lines, without line terminators. */
  lines: string[];
  interrupt: boolean;
  endOfInput: boolean;
}

/**
 * Minimal line discipline for a pseudoterminal: echoes typed characters, handles
 * backspace, and hands complete lines to the program on Enter.
 */
export class LineInput {
  private buffer = "";
  private lastWasCR = false;

  feed(data: string): InputResult {
    const result: InputResult = { echo: "", lines: [], interrupt: false, endOfInput: false };
    // Escape sequences (arrows, function keys) are ignored.
    const cleaned = data.replace(new RegExp(`${ESC}(\\[[0-9;?]*[ -/]*[@-~]|O.|.)`, "g"), "");
    for (const ch of cleaned) {
      const afterCR = this.lastWasCR;
      this.lastWasCR = ch === "\r";
      if (ch === "\n" && afterCR) continue;
      if (ch === "\r" || ch === "\n") {
        result.lines.push(this.buffer);
        result.echo += "\r\n";
        this.buffer = "";
      } else if (ch === DELETE || ch === BACKSPACE) {
        if (this.buffer.length > 0) {
          this.buffer = [...this.buffer].slice(0, -1).join("");
          result.echo += `${BACKSPACE} ${BACKSPACE}`;
        }
      } else if (ch === CTRL_C) {
        result.interrupt = true;
        result.echo += "^C\r\n";
        this.buffer = "";
      } else if (ch === CTRL_D) {
        if (this.buffer.length > 0) result.lines.push(this.buffer);
        result.endOfInput = true;
        this.buffer = "";
      } else if (ch >= " ") {
        this.buffer += ch;
        result.echo += ch;
      }
    }
    return result;
  }

  reset(): void {
    this.buffer = "";
    this.lastWasCR = false;
  }
}
