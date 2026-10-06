/** A VS Code extension that can attach to a JVM listening on a JDWP port. */
export interface JvmDebugger {
  /** Marketplace id of the extension that provides the debug type. */
  extensionId: string;
  /** Debug configuration `type`. */
  type: string;
  /** Whether `port` is a string in this debugger's attach schema. */
  portAsString: boolean;
  label: string;
}

/** In order of preference. */
export const DEBUGGERS: readonly JvmDebugger[] = [
  { extensionId: "vscjava.vscode-java-debug", type: "java", portAsString: false, label: "Debugger for Java" },
  { extensionId: "oracle.oracle-java", type: "jdk", portAsString: true, label: "Oracle Java Platform" },
];

export function pickDebugger(isInstalled: (extensionId: string) => boolean): JvmDebugger | undefined {
  return DEBUGGERS.find((d) => isInstalled(d.extensionId));
}

export function attachConfig(debuggerInfo: JvmDebugger, port: number, sourcePaths: readonly string[]): Record<string, unknown> {
  return {
    type: debuggerInfo.type,
    request: "attach",
    name: "Kotlin: attach to JVM",
    hostName: "127.0.0.1",
    port: debuggerInfo.portAsString ? String(port) : port,
    sourcePaths: [...sourcePaths],
  };
}
