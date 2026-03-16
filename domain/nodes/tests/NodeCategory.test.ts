import { describe, expect, it } from "bun:test";
import { NodeCategory } from "../NodeCategory";

describe("NodeCategory", () => {
  it("normalizes aliases and formatting in constructor", () => {
    expect(new NodeCategory("  INPUTS ").value).toBe("input");
    expect(new NodeCategory("multi_modal").value).toBe("multimodal");
  });

  it("throws when category is empty", () => {
    expect(() => new NodeCategory("   ")).toThrow("NodeCategory cannot be empty.");
  });

  it("checks equality against strings and objects", () => {
    const category = new NodeCategory("retrieval");
    expect(category.equals("search")).toBe(true);
    expect(category.equals(new NodeCategory("RAG"))).toBe(true);
    expect(category.equals("output")).toBe(false);
    expect(category.equals(undefined)).toBe(false);
  });

  it("identifies known and custom categories", () => {
    expect(new NodeCategory("tool").isKnown()).toBe(true);
    expect(new NodeCategory("custom").isCustom()).toBe(true);
    expect(new NodeCategory("plugin-x").isKnown()).toBe(false);
    expect(new NodeCategory("plugin-x").isCustom()).toBe(true);
  });

  it("supports static create/from/helpers", () => {
    const created = NodeCategory.create("image");
    const fromString = NodeCategory.from("models");
    const fromInstance = NodeCategory.from(created);

    expect(created.value).toBe("vision");
    expect(fromString.value).toBe("model");
    expect(fromInstance).toBe(created);
  });

  it("supports known conversion and matching helpers", () => {
    expect(NodeCategory.isKnown("workflow")).toBe(true);
    expect(NodeCategory.toKnown("helpers")).toBe("utility");
    expect(NodeCategory.toKnown("plugin-x")).toBeUndefined();

    expect(NodeCategory.matches("tool", "agent")).toBe(true);
    expect(NodeCategory.matches(new NodeCategory("sources"), "input")).toBe(true);
    expect(NodeCategory.matches(null, "input")).toBe(false);

    expect(NodeCategory.anyOf("source", ["output", "input"])) .toBe(true);
    expect(NodeCategory.anyOf(undefined, ["input"])) .toBe(false);
  });

  it("returns canonical values collection", () => {
    const values = NodeCategory.values();

    expect(values.length).toBe(19);
    expect(values).toContain("custom");
    expect(() => (values as string[]).push("oops")).toThrow();
    expect(NodeCategory.INPUT.value).toBe("input");
    expect(NodeCategory.OUTPUT.toString()).toBe("output");
  });
});
