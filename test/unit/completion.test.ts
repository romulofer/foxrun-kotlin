import * as assert from "node:assert/strict";
import { computeCompletions, Group } from "../../src/core/completion";
import { KotlinSymbol } from "../../src/core/symbolExtractor";

const complete = (marked: string, workspace: KotlinSymbol[] = []) =>
  computeCompletions(marked.replace("|", ""), marked.indexOf("|"), workspace);

const labels = (marked: string) => (complete(marked) ?? []).map((c) => c.label);

describe("computeCompletions", () => {
  it("offers keywords, snippets and stdlib in code", () => {
    const items = complete("fun f() {\n  pri|\n}")!;
    assert.ok(items.some((c) => c.label === "println" && c.group === Group.Stdlib));
    assert.ok(items.some((c) => c.label === "private" && c.kind === "keyword"));
    assert.ok(items.some((c) => c.label === "main" && c.kind === "snippet" && c.snippet?.includes("fun main()")));
  });

  it("offers declarations from the document", () => {
    const items = complete("class Greeter\nfun greet(name: String) {\n  val count = 1\n  |\n}\nfun later() {}")!;
    const doc = items.filter((c) => c.group === Group.Document).map((c) => c.label);
    for (const name of ["Greeter", "greet", "name", "count", "later"]) assert.ok(doc.includes(name), name);
  });

  it("hides locals declared after the cursor", () => {
    assert.equal(labels("fun f() {\n  |\n  val afterwards = 1\n}").includes("afterwards"), false);
  });

  it("offers workspace symbols after document symbols", () => {
    const workspace: KotlinSymbol[] = [
      { name: "helper", kind: "function", line: 0, topLevel: true, isPrivate: false, detail: "fun helper()" },
    ];
    const helper = complete("|", workspace)!.find((c) => c.label === "helper");
    assert.equal(helper?.group, Group.Workspace);
    assert.equal(helper?.detail, "fun helper()");
  });

  it("lets a document declaration shadow a stdlib name", () => {
    const items = complete("fun println(x: Int) {}\n|")!.filter((c) => c.label === "println" && c.kind !== "snippet");
    assert.equal(items.length, 1);
    assert.equal(items[0].group, Group.Document);
  });

  it("returns undefined inside comments and strings", () => {
    assert.equal(complete("// pri|"), undefined);
    assert.equal(complete(`val s = "pri|"`), undefined);
    assert.equal(complete("/* pri| */"), undefined);
  });

  it("completes inside string templates", () => {
    assert.ok(labels(`val s = "\${pri|}"`).includes("println"));
  });

  it("returns undefined after @", () => {
    assert.equal(complete("@Dep|"), undefined);
  });

  it("offers scope functions and document words after a dot", () => {
    const items = complete("val total = 1\nval x = total.|")!;
    const ls = items.map((c) => c.label);
    assert.ok(ls.includes("let"));
    assert.ok(ls.includes("total"));
    assert.equal(ls.includes("println"), false);
    assert.equal(ls.includes("class"), false);
  });
});
