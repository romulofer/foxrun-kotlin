import * as assert from "node:assert/strict";
import { memberCompletions } from "../../src/core/memberCompletion";
import { extractSymbols } from "../../src/core/symbolExtractor";

/** `|` marks the cursor; the dot being completed is the last `.` before it. */
function members(marked: string, extra = ""): string[] | undefined {
  const text = marked.replace("|", "");
  const cursor = marked.indexOf("|");
  const dot = text.lastIndexOf(".", cursor - 1);
  return memberCompletions(text, dot, extractSymbols(extra + "\n" + text))?.map((m) => m.label);
}

function has(labels: string[] | undefined, ...names: string[]): void {
  assert.ok(labels, "expected members");
  for (const n of names) assert.ok(labels.includes(n), `${n} not in ${labels.join(", ")}`);
}

describe("memberCompletions", () => {
  it("completes string literals", () => {
    has(members(`val a = "abc".|`), "length", "uppercase", "substring", "split");
  });

  it("completes lists, maps and sets from factory calls", () => {
    has(members("val a = listOf(1).|"), "map", "filter", "size");
    has(members("val m = mutableMapOf<String, Int>()\nval a = m.|"), "put", "keys", "getOrPut");
    has(members("val s = setOf(1, 2)\nval a = s.|"), "contains", "size", "map");
  });

  it("completes mutable list members only on mutable lists", () => {
    has(members("val l = mutableListOf(1)\nval a = l.|"), "add", "removeAt", "map");
    assert.equal(members("val l = listOf(1)\nval a = l.|")?.includes("add"), false);
  });

  it("uses declared types, parameters and numbers", () => {
    has(members("val s: String = read()\nval a = s.|"), "length");
    has(members("fun f(items: List<Int>) {\n  items.|\n}"), "map", "size");
    has(members("val n = 42\nval a = n.|"), "toString", "coerceAtLeast");
    has(members("val d = 1.5\nval a = d.|"), "roundToInt", "isNaN");
    has(members("val c = 'x'\nval a = c.|"), "isDigit", "uppercase");
    has(members("val b = true\nval a = b.|"), "not");
  });

  it("completes members of classes declared in the source", () => {
    const src = "class Person(val name: String, age: Int) {\n  var nick = \"\"\n  fun greet(): String = \"hi\"\n  private fun secret() {}\n}\n";
    const labels = members(`${src}val p = Person("a")\nval x = p.|`);
    has(labels, "name", "nick", "greet", "toString");
    assert.equal(labels?.includes("secret"), false);
    assert.equal(labels?.includes("age"), false);
  });

  it("completes members of classes declared elsewhere in the workspace", () => {
    const labels = members(`val p = Person("a")\nval x = p.|`, "class Person { fun greet() {} }");
    has(labels, "greet");
  });

  it("completes this inside a class", () => {
    has(members("class Box {\n  val size = 1\n  fun f() { this.| }\n}"), "size", "f");
  });

  it("follows chained calls and properties", () => {
    has(members(`val a = "a b".uppercase().|`), "length", "lowercase");
    has(members(`val a = "a b".split(" ").|`), "map", "size");
    has(members("val p = Person()\nval a = p.name.|", "class Person { val name: String = \"\" }"), "length");
    has(members("fun make(): Person = Person()\nval a = make().|", "class Person { fun greet() {} }"), "greet");
  });

  it("handles safe calls and not null assertions", () => {
    has(members("val s: String? = null\nval a = s?.|"), "length");
    has(members("val s: String? = null\nval a = s!!.|"), "length");
  });

  it("filters by the typed prefix position", () => {
    has(members(`val a = "abc".len|`), "length");
  });

  it("returns undefined for unknown receivers", () => {
    assert.equal(members("val a = foo().|"), undefined);
    assert.equal(members("val a = (x + y).|"), undefined);
    assert.equal(members("import kotlin.collections.|"), undefined);
  });

  it("offers function snippets", () => {
    const text = `val a = "abc".`;
    const items = memberCompletions(text, text.length - 1, [])!;
    assert.equal(items.find((m) => m.label === "length")?.snippet, undefined);
    assert.equal(items.find((m) => m.label === "uppercase")?.snippet, "uppercase()");
    assert.equal(items.find((m) => m.label === "substring")?.snippet, "substring($0)");
    assert.equal(items.find((m) => m.label === "map")?.snippet, "map { $0 }");
  });
});
