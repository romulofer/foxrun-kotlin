import * as assert from "node:assert/strict";
import { contextAt, lex } from "../../src/core/lexer";

describe("lexer", () => {
  it("tokenizes identifiers, numbers, strings and punctuation", () => {
    const { tokens } = lex(`val x = 1_000L + "a"`);
    assert.deepEqual(
      tokens.map((t) => [t.kind, t.text]),
      [
        ["identifier", "val"],
        ["identifier", "x"],
        ["punct", "="],
        ["number", "1_000L"],
        ["punct", "+"],
        ["string", "\"a\""],
      ],
    );
  });

  it("keeps braces inside strings and comments out of the token stream", () => {
    const { tokens } = lex(`"{" /* { */ // }\n'}'`);
    assert.deepEqual(
      tokens.map((t) => t.kind),
      ["string", "comment", "comment", "char"],
    );
  });

  it("handles nested block comments", () => {
    const { tokens } = lex("/* a /* b */ c */ x");
    assert.equal(tokens.length, 2);
    assert.equal(tokens[1].text, "x");
  });

  it("handles raw strings with quotes and templates", () => {
    const src = `"""say "hi" \${ "}" }""" y`;
    const { tokens, templateRanges } = lex(src);
    assert.equal(tokens[0].kind, "string");
    assert.equal(tokens[0].text, `"""say "hi" \${ "}" }"""`);
    assert.equal(tokens[1].text, "y");
    assert.equal(templateRanges.length, 1);
  });

  it("strips backticks from quoted identifiers", () => {
    const { tokens } = lex("fun `my test`()");
    assert.equal(tokens[1].kind, "identifier");
    assert.equal(tokens[1].text, "my test");
  });

  it("does not consume range dots into numbers", () => {
    const { tokens } = lex("1..10 3.5e-2");
    assert.deepEqual(tokens.map((t) => t.text), ["1", ".", ".", "10", "3.5e-2"]);
  });

  it("tracks line numbers", () => {
    const { tokens } = lex("a\n\nb");
    assert.deepEqual(tokens.map((t) => t.line), [0, 2]);
  });
});

describe("contextAt", () => {
  const at = (marked: string) => contextAt(marked.replace("|", ""), marked.indexOf("|"));

  it("detects code", () => assert.equal(at("val x = |"), "code"));
  it("detects line comments", () => assert.equal(at("// hello |"), "comment"));
  it("detects block comments", () => assert.equal(at("/* hel|lo */"), "comment"));
  it("detects unterminated block comments", () => assert.equal(at("/* hello |"), "comment"));
  it("detects strings", () => assert.equal(at(`val s = "ab|c"`), "string"));
  it("detects unterminated strings", () => assert.equal(at(`val s = "ab|`), "string"));
  it("treats template expressions as code", () => assert.equal(at(`val s = "\${na|me}"`), "code"));
  it("is code right after a closed string", () => assert.equal(at(`val s = "abc"|`), "code"));
});
