import { describe, expect, it } from "bun:test";
import { PythonRuntimeMode, parsePythonRuntimeMode } from "../PythonRuntimeMode";

describe("PythonRuntimeMode", () => {
  it("parses disabled aliases", () => {
    expect(parsePythonRuntimeMode()).toBe(PythonRuntimeMode.disabled);
    expect(parsePythonRuntimeMode("off")).toBe(PythonRuntimeMode.disabled);
  });

  it("parses local-http aliases", () => {
    expect(parsePythonRuntimeMode("local-http")).toBe(PythonRuntimeMode.localHttp);
    expect(parsePythonRuntimeMode("python")).toBe(PythonRuntimeMode.localHttp);
  });

  it("throws on unsupported mode", () => {
    expect(() => parsePythonRuntimeMode("remote")).toThrow();
  });
});
