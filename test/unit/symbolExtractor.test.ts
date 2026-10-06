import * as assert from "node:assert/strict";
import { extractSymbols, KotlinSymbol } from "../../src/core/symbolExtractor";

const find = (symbols: KotlinSymbol[], name: string) => {
  const s = symbols.find((x) => x.name === name);
  assert.ok(s, `symbol ${name} not found in ${symbols.map((x) => x.name).join(", ")}`);
  return s;
};

describe("extractSymbols", () => {
  it("extracts top level functions with signatures", () => {
    const symbols = extractSymbols("fun greet(name: String, times: Int = 1): String {\n  return name\n}");
    const greet = find(symbols, "greet");
    assert.equal(greet.kind, "function");
    assert.equal(greet.topLevel, true);
    assert.equal(greet.line, 0);
    assert.equal(greet.detail, "fun greet(name: String, times: Int = 1): String");
  });

  it("extracts parameters as non top level", () => {
    const symbols = extractSymbols("fun f(a: Int, b: (Int) -> Unit, c: Map<String, Int>) {}");
    assert.deepEqual(
      symbols.filter((s) => s.kind === "parameter").map((s) => [s.name, s.detail, s.topLevel]),
      [
        ["a", "a: Int", false],
        ["b", "b: (Int) -> Unit", false],
        ["c", "c: Map<String, Int>", false],
      ],
    );
  });

  it("extracts generic and extension functions", () => {
    const symbols = extractSymbols("fun <T> List<T>.second(): T = this[1]\nfun String.shout() = uppercase()");
    assert.equal(find(symbols, "second").kind, "function");
    assert.equal(find(symbols, "shout").detail, "fun String.shout()");
  });

  it("extracts classes, interfaces, objects and type aliases", () => {
    const symbols = extractSymbols(
      "data class Point(val x: Int, var y: Int, z: Int)\nsealed interface Shape\nobject Registry\ntypealias Names = List<String>\nfun interface Action { fun run() }",
    );
    assert.equal(find(symbols, "Point").kind, "class");
    assert.equal(find(symbols, "Shape").kind, "interface");
    assert.equal(find(symbols, "Registry").kind, "object");
    assert.equal(find(symbols, "Names").kind, "typealias");
    assert.equal(find(symbols, "Action").kind, "interface");
    assert.equal(find(symbols, "x").kind, "property");
    assert.equal(find(symbols, "x").detail, "val x: Int");
    assert.equal(find(symbols, "z").kind, "parameter");
    assert.equal(find(symbols, "run").topLevel, false);
  });

  it("distinguishes properties from local variables", () => {
    const src = [
      "val top = 1",
      "class A {",
      "  val member: String = \"\"",
      "  companion object {",
      "    const val MAX = 3",
      "  }",
      "  fun f() {",
      "    val local = 2",
      "    var (p, q) = 1 to 2",
      "  }",
      "}",
    ].join("\n");
    const symbols = extractSymbols(src);
    assert.equal(find(symbols, "top").kind, "property");
    assert.equal(find(symbols, "top").topLevel, true);
    assert.equal(find(symbols, "member").kind, "property");
    assert.equal(find(symbols, "member").topLevel, false);
    assert.equal(find(symbols, "MAX").kind, "property");
    assert.equal(find(symbols, "local").kind, "variable");
    assert.equal(find(symbols, "p").kind, "variable");
    assert.equal(find(symbols, "q").kind, "variable");
  });

  it("extracts extension properties", () => {
    const symbols = extractSymbols("val String.lastChar: Char get() = this[length - 1]");
    assert.equal(find(symbols, "lastChar").detail, "val String.lastChar: Char");
  });

  it("extracts enum entries", () => {
    const symbols = extractSymbols("enum class Color(val rgb: Int) { RED(0xFF0000), GREEN(0x00FF00) { override fun x() = 1 }, BLUE; fun f() {} }");
    assert.deepEqual(
      symbols.filter((s) => s.kind === "enumEntry").map((s) => s.name),
      ["RED", "GREEN", "BLUE"],
    );
  });

  it("extracts for loop and lambda variables", () => {
    const symbols = extractSymbols("fun f() { for (item in items) {}\n for ((k, v) in map) {}\n list.forEach { element -> }\n map.forEach { a, _ -> } }");
    for (const name of ["item", "k", "v"]) assert.equal(find(symbols, name).kind, "variable");
    assert.equal(find(symbols, "element").kind, "parameter");
    assert.equal(find(symbols, "a").kind, "parameter");
    assert.equal(symbols.some((s) => s.name === "_"), false);
  });

  it("marks private declarations", () => {
    const symbols = extractSymbols("private fun hidden() {}\ninternal fun shown() {}\nprivate data class P(val a: Int)");
    assert.equal(find(symbols, "hidden").isPrivate, true);
    assert.equal(find(symbols, "shown").isPrivate, false);
    assert.equal(find(symbols, "P").isPrivate, true);
  });

  it("ignores Foo::class and keywords in comments or strings", () => {
    const symbols = extractSymbols("val k = Foo::class\n// fun ghost() {}\nval s = \"class Ghost\"");
    assert.deepEqual(symbols.map((s) => s.name), ["k", "s"]);
  });

  it("records the owning type of members", () => {
    const src = [
      "class Person(val name: String, age: Int) {",
      "  var nick = \"\"",
      "  fun greet(): String { val local = 1; return nick }",
      "  companion object { val DEFAULT = 1 }",
      "  class Inner { fun deep() {} }",
      "}",
      "enum class Color { RED, GREEN }",
      "fun top() {}",
    ].join("\n");
    const symbols = extractSymbols(src);
    const owner = (name: string) => find(symbols, name).container;
    assert.equal(owner("name"), "Person");
    assert.equal(owner("age"), undefined);
    assert.equal(owner("nick"), "Person");
    assert.equal(owner("greet"), "Person");
    assert.equal(owner("local"), undefined);
    assert.equal(owner("DEFAULT"), "Person");
    assert.equal(owner("Inner"), "Person");
    assert.equal(owner("deep"), "Inner");
    assert.equal(owner("RED"), "Color");
    assert.equal(owner("Person"), undefined);
    assert.equal(owner("top"), undefined);
  });
});
