import * as vscode from "vscode";
import { findMainFunctions } from "../core/mainDetector";
import { isScript } from "../core/runCommand";

export const RUN_COMMAND = "kotlin.run";

export class RunCodeLensProvider implements vscode.CodeLensProvider {
  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    if (isScript(document.fileName)) {
      return [this.lens(new vscode.Range(0, 0, 0, 0), document.uri, "$(play) Run Script")];
    }
    return findMainFunctions(document.getText()).map((main) => {
      const position = new vscode.Position(main.line, main.character);
      return this.lens(new vscode.Range(position, position), document.uri, "$(play) Run");
    });
  }

  private lens(range: vscode.Range, uri: vscode.Uri, title: string): vscode.CodeLens {
    return new vscode.CodeLens(range, {
      title,
      tooltip: "Compile and run this file",
      command: RUN_COMMAND,
      arguments: [uri],
    });
  }
}
