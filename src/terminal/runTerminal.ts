import * as vscode from "vscode";
import { LineInput } from "../core/lineInput";
import { OutputKind, ProcessSession } from "../core/processSession";
import { RunStep } from "../core/runCommand";

export const TERMINAL_NAME = "Kotlin Run";

const ESC = String.fromCharCode(27);
const RESET = `${ESC}[0m`;
const STYLE: Record<OutputKind, string> = {
  stdout: "",
  stderr: `${ESC}[31m`,
  info: `${ESC}[2m`,
  error: `${ESC}[1;31m`,
};
const CLEAR = `${ESC}[2J${ESC}[3J${ESC}[H`;

/** Follows one run: everything the steps print, and how the run ended. */
export interface RunObserver {
  output?(text: string): void;
  exit?(code: number | null): void;
}

/** Executes run steps. Swappable so tests can observe runs without a terminal. */
export interface CommandRunner {
  run(steps: RunStep[], cwd: string, fileName: string, clear: boolean, observer?: RunObserver): void;
}

/** Observes the compile step of runs shown in the terminal. */
export interface RunHooks {
  started(fileName: string, cwd: string): void;
  compiled(fileName: string, cwd: string, output: string, code: number | null): void;
}

/** Shows runs in a single `Kotlin Run` terminal that prints only the program's output. */
export class TerminalRunner implements CommandRunner, vscode.Disposable {
  private terminal: vscode.Terminal | undefined;
  private pty: RunPty | undefined;
  constructor(private readonly hooks?: RunHooks) {}

  private readonly onClose = vscode.window.onDidCloseTerminal((t) => {
    if (t === this.terminal) {
      this.terminal = undefined;
      this.pty = undefined;
    }
  });

  run(steps: RunStep[], cwd: string, fileName: string, clear: boolean, observer?: RunObserver): void {
    if (!this.terminal || !this.pty) {
      this.pty = new RunPty();
      this.terminal = vscode.window.createTerminal({ name: TERMINAL_NAME, pty: this.pty, iconPath: new vscode.ThemeIcon("play") });
    }
    this.terminal.show(true);
    this.hooks?.started(fileName, cwd);
    this.pty.start(steps, cwd, fileName, clear, this.hooks, observer);
  }

  dispose(): void {
    this.onClose.dispose();
    this.terminal?.dispose();
  }
}

class RunPty implements vscode.Pseudoterminal {
  private readonly writeEmitter = new vscode.EventEmitter<string>();
  private readonly closeEmitter = new vscode.EventEmitter<number | void>();
  readonly onDidWrite = this.writeEmitter.event;
  readonly onDidClose = this.closeEmitter.event;

  private opened = false;
  private pending: (() => void) | undefined;
  private session: ProcessSession | undefined;
  private readonly input = new LineInput();
  /** Whether the cursor is at the start of a line, so status lines do not run into output. */
  private atLineStart = true;
  private written = false;

  open(): void {
    this.opened = true;
    this.pending?.();
    this.pending = undefined;
  }

  close(): void {
    this.session?.kill();
    this.writeEmitter.dispose();
    this.closeEmitter.dispose();
  }

  handleInput(data: string): void {
    if (!this.session?.running) return;
    const result = this.input.feed(data);
    if (result.echo) this.print(result.echo);
    for (const line of result.lines) this.session.write(`${line}\n`);
    if (result.endOfInput) this.session.endInput();
    if (result.interrupt) this.session.kill();
  }

  start(steps: RunStep[], cwd: string, fileName: string, clear: boolean, hooks?: RunHooks, observer?: RunObserver): void {
    const go = () => {
      this.session?.kill();
      this.input.reset();
      if (clear) {
        this.writeEmitter.fire(CLEAR);
        this.atLineStart = true;
      } else if (this.written) {
        this.output("\n", "stdout");
      }
      // Output of a replaced session (e.g. its "stopped" line) is dropped.
      const session: ProcessSession = new ProcessSession(steps, cwd, fileName, {
        output: (text, kind) => {
          if (this.session !== session) return;
          this.output(text, kind);
          observer?.output?.(text);
        },
        exit: (code) => {
          if (this.session === session) observer?.exit?.(code);
        },
        compiled: (output, code) => {
          if (this.session === session) hooks?.compiled(fileName, cwd, output, code);
        },
      });
      this.session = session;
      session.start();
    };
    if (this.opened) go();
    else this.pending = go;
  }

  private output(text: string, kind: OutputKind): void {
    if ((kind === "info" || kind === "error") && text.startsWith("\n")) {
      // Status lines start with a blank line; keep exactly one between output and status.
      text = (this.atLineStart ? "\n" : "\n\n") + text.slice(1);
    }
    const style = STYLE[kind];
    this.print(style ? `${style}${text}${RESET}` : text);
  }

  private print(text: string): void {
    if (text.length === 0) return;
    this.written = true;
    const plain = text.replace(new RegExp(`${ESC}\\[[0-9;]*m`, "g"), "");
    if (plain.length > 0) this.atLineStart = plain.endsWith("\n");
    this.writeEmitter.fire(text.replace(/\r?\n/g, "\r\n"));
  }
}
