import { ChildProcess, spawn } from "node:child_process";
import * as path from "node:path";
import { quoteForCmd, RunStep } from "./runCommand";

export type OutputKind = "stdout" | "stderr" | "info" | "error";

export interface SessionEvents {
  output(text: string, kind: OutputKind): void;
  /** Called once, after the last step ends, a step fails or the session is killed. */
  exit(code: number | null): void;
}

export type SpawnFn = typeof spawn;

/**
 * Runs steps one after another, streaming their output, and stops at the first failure.
 * Prints a short status line before compiling and after the program ends.
 */
export class ProcessSession {
  private child: ChildProcess | undefined;
  private killed = false;
  private finished = false;
  private readonly startedAt = Date.now();

  constructor(
    private readonly steps: readonly RunStep[],
    private readonly cwd: string,
    private readonly fileName: string,
    private readonly events: SessionEvents,
    private readonly spawnFn: SpawnFn = spawn,
    private readonly platform: NodeJS.Platform = process.platform,
  ) {}

  get running(): boolean {
    return !this.finished;
  }

  start(): this {
    this.runStep(0);
    return this;
  }

  /** Sends text to the running program's stdin. */
  write(text: string): void {
    this.child?.stdin?.write(text);
  }

  endInput(): void {
    this.child?.stdin?.end();
  }

  kill(): void {
    if (this.finished) return;
    this.killed = true;
    if (this.child) this.child.kill();
    else this.finish(null);
  }

  private runStep(index: number): void {
    if (this.killed) return;
    const step = this.steps[index];
    if (!step) return;
    if (step.kind === "compile") this.events.output(`Compiling ${path.basename(this.fileName)}...\n`, "info");

    let child: ChildProcess;
    try {
      child = this.spawnStep(step);
    } catch (e) {
      this.events.output(`Failed to start ${step.command}: ${(e as Error).message}\n`, "error");
      this.finish(null);
      return;
    }
    this.child = child;
    child.stdout?.setEncoding("utf8").on("data", (d: string) => this.events.output(d, "stdout"));
    child.stderr?.setEncoding("utf8").on("data", (d: string) => this.events.output(d, "stderr"));
    child.stdin?.on("error", () => {});
    child.on("error", (e) => {
      this.events.output(`Failed to start ${step.command}: ${e.message}\n`, "error");
      this.finish(null);
    });
    child.on("close", (code, signal) => {
      this.child = undefined;
      if (this.finished) return;
      if (this.killed) {
        this.events.output(`\nProcess stopped${signal ? ` (${signal})` : ""}\n`, "info");
        this.finish(code);
      } else if (code !== 0 && step.kind === "compile") {
        this.events.output(`\nCompilation failed with exit code ${code}\n`, "error");
        this.finish(code);
      } else if (index + 1 < this.steps.length && code === 0) {
        this.runStep(index + 1);
      } else {
        this.events.output(`\nProcess finished with exit code ${code} (${this.elapsed()})\n`, code === 0 ? "info" : "error");
        this.finish(code);
      }
    });
  }

  private spawnStep(step: RunStep): ChildProcess {
    const options = { cwd: this.cwd, env: process.env };
    // Windows can only launch .bat/.cmd (kotlinc.bat) through a shell.
    if (this.platform === "win32" && /\.(bat|cmd)$/i.test(step.command)) {
      const line = [step.command, ...step.args].map(quoteForCmd).join(" ");
      return this.spawnFn(line, [], { ...options, shell: true });
    }
    return this.spawnFn(step.command, step.args, options);
  }

  private elapsed(): string {
    return `${((Date.now() - this.startedAt) / 1000).toFixed(1)}s`;
  }

  private finish(code: number | null): void {
    if (this.finished) return;
    this.finished = true;
    this.events.exit(code);
  }
}
