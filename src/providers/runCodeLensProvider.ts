import * as vscode from "vscode";
import { findMainFunctions } from "../core/mainDetector";
import { isScript } from "../core/runCommand";

import { DEBUG_COMMAND } from "../commands/ids";

export const RUN_COMMAND = "kotlin.run";

export class RunCodeLensProvider implements vscode.CodeLensProvider {
  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    if (isScript(document.fileName)) {
      return [this.lens(new vscode.Range(0, 0, 0, 0), document.uri, "$(play) Run Script")];
    }
    return findMainFunctions(document.getText()).flatMap((main) => {
      const position = new vscode.Position(main.line, main.character);
      const range = new vscode.Range(position, position);
      return [
        this.lens(range, document.uri, "$(play) Run"),
        this.lens(range, document.uri, "$(bug) Debug", DEBUG_COMMAND, "Compile and debug this file"),
      ];
    });
  }

  private lens(range: vscode.Range, uri: vscode.Uri, title: string, command = RUN_COMMAND, tooltip = "Compile and run this file"): vscode.CodeLens {
    return new vscode.CodeLens(range, { title, tooltip, command, arguments: [uri] });
  }
}
