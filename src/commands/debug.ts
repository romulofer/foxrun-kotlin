import * as net from "node:net";
import * as vscode from "vscode";
import { attachConfig, DEBUGGERS, pickDebugger } from "../core/debugConfig";
import { isScript, RunStep } from "../core/runCommand";
import { resolveDocument, RunOptions, runKotlinFile } from "./run";

/** What debugging needs from VS Code. Replaceable so tests do not need a Java debugger. */
export interface DebugHost {
  isInstalled(extensionId: string): boolean;
  startDebugging(folder: vscode.WorkspaceFolder | undefined, config: Record<string, unknown>): Thenable<boolean>;
}

export const vscodeDebugHost: DebugHost = {
  isInstalled: (id) => vscode.extensions.getExtension(id) !== undefined,
  startDebugging: (folder, config) => vscode.debug.startDebugging(folder, config as unknown as vscode.DebugConfiguration),
};

const STARTUP_TIMEOUT_MS = 120_000;
const LISTENING = /Listening for transport dt_socket/;

/**
 * Compiles (when needed), starts the program suspended with a JDWP agent in the Kotlin Run terminal,
 * then attaches the installed Java debugger. Returns the steps that were run, or undefined when aborted.
 */
export async function debugKotlinFile(
  target: vscode.Uri | undefined,
  options: RunOptions,
  host: DebugHost = vscodeDebugHost,
): Promise<RunStep[] | undefined> {
  const document = await resolveDocument(target);
  if (!document) {
    void vscode.window.showErrorMessage("Open a Kotlin file to debug it.");
    return undefined;
  }
  if (isScript(document.fileName)) {
    void vscode.window.showErrorMessage("Kotlin scripts cannot be debugged. Debug a .kt file with a main function.");
    return undefined;
  }
  const debuggerInfo = pickDebugger((id) => host.isInstalled(id));
  if (!debuggerInfo) {
    void offerDebuggerInstall();
    return undefined;
  }

  const port = await freePort();
  let seen = "";
  let listening: () => void = () => {};
  let ended: (reason: Error) => void = () => {};
  const ready = new Promise<void>((resolve, reject) => {
    listening = resolve;
    ended = reject;
  });
  const steps = await runKotlinFile(document.uri, {
    ...options,
    debugPort: port,
    observer: {
      output(text) {
        seen += text;
        if (LISTENING.test(seen)) listening();
      },
      exit() {
        ended(new Error("The program ended before a debugger could attach. See the Kotlin Run terminal."));
      },
    },
  });
  if (!steps) return undefined;

  try {
    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: "Starting the JVM for debugging...", cancellable: true },
      (_progress, token) =>
        new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error("Timed out waiting for the JVM to start.")), STARTUP_TIMEOUT_MS);
          token.onCancellationRequested(() => reject(new Error("Debugging was cancelled. Press Ctrl+C in the Kotlin Run terminal to stop the JVM.")));
          ready.then(resolve, reject).finally(() => clearTimeout(timer));
        }),
    );
  } catch (e) {
    void vscode.window.showErrorMessage((e as Error).message);
    return steps;
  }

  const folder = vscode.workspace.getWorkspaceFolder(document.uri);
  const sourceRoots = [folder?.uri.fsPath, ...(vscode.workspace.workspaceFolders ?? []).map((f) => f.uri.fsPath)].filter(
    (p, i, all): p is string => !!p && all.indexOf(p) === i,
  );
  const started = await host.startDebugging(folder, attachConfig(debuggerInfo, port, sourceRoots));
  if (!started) void vscode.window.showErrorMessage(`The ${debuggerInfo.label} debugger could not attach to the JVM on port ${port}.`);
  return steps;
}

async function offerDebuggerInstall(): Promise<void> {
  const choice = await vscode.window.showErrorMessage(
    "Debugging Kotlin needs a Java debugger extension (Debugger for Java or Oracle Java Platform).",
    "Install Debugger for Java",
  );
  if (choice) await vscode.commands.executeCommand("extension.open", DEBUGGERS[0].extensionId);
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as net.AddressInfo;
      server.close(() => resolve(port));
    });
  });
}
