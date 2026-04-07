import { describe, expect, it } from "bun:test";
import { PythonRuntimeMode, parsePythonRuntimeMode } from "../PythonRuntimeMode";

describe("PythonRuntimeMode", () => {
  it("parses disabled aliases", () => {
    expect(parsePythonRuntimeMode()).toBe(PythonRuntimeMode.disabled);
    expect(parsePythonRuntimeMode("off")).toBe(PythonRuntimeMode.disabled);
  });

  it("parses external-http aliases", () => {
    expect(parsePythonRuntimeMode("external-http")).toBe(PythonRuntimeMode.externalHttp);
    expect(parsePythonRuntimeMode("external")).toBe(PythonRuntimeMode.externalHttp);
  });

  it("parses managed-local aliases including legacy local-http", () => {
    expect(parsePythonRuntimeMode("managed-local")).toBe(PythonRuntimeMode.managedLocal);
    expect(parsePythonRuntimeMode("local-http")).toBe(PythonRuntimeMode.managedLocal);
    expect(parsePythonRuntimeMode("python")).toBe(PythonRuntimeMode.managedLocal);
  });

  it("throws on unsupported mode", () => {
    expect(() => parsePythonRuntimeMode("remote")).toThrow();
  });
});
