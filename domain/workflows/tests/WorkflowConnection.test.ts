import { describe, expect, it } from "bun:test";
import {
  WorkflowConnection,
  WorkflowConnectionCompatibilitySnapshot,
  WorkflowConnectionEndpoint,
  WorkflowConnectionMetadata,
} from "../WorkflowConnection";

describe("WorkflowConnection", () => {
  it("validates endpoint and connection identity rules", () => {
    expect(() => new WorkflowConnectionEndpoint({ nodeId: "", portId: "x" })).toThrow();
    expect(() => new WorkflowConnectionEndpoint({ nodeId: "n", portId: " " })).toThrow();

    expect(
      () =>
        new WorkflowConnection({
          id: "id",
          source: { nodeId: "n", portId: "p" },
          target: { nodeId: "n", portId: "p" },
        })
    ).toThrow("WorkflowConnection source and target cannot be the same endpoint.");
  });

  it("normalizes metadata and snapshot cloning", () => {
    const metadata = new WorkflowConnectionMetadata({
      label: "  label ",
      description: "  desc ",
      tags: [" a ", "", " b "],
    });

    expect(metadata.label).toBe("label");
    expect(metadata.description).toBe("desc");
    expect(metadata.tags).toEqual(["a", "b"]);

    const snapshot = new WorkflowConnectionCompatibilitySnapshot({
      valueTypes: ["text"],
    });
    const clone = WorkflowConnectionCompatibilitySnapshot.from(snapshot);
    expect(clone).toEqual(snapshot);
    expect(clone).not.toBe(snapshot);
  });

  it("supports equality and immutable modifiers", () => {
    const connection = new WorkflowConnection({
      id: " c1 ",
      source: { nodeId: "a", portId: "out" },
      target: { nodeId: "b", portId: "in" },
      kind: "data",
    });

    expect(connection.id).toBe("c1");
    expect(connection.involvesNode("a")).toBeTrue();
    expect(connection.involvesEndpoint({ nodeId: "b", portId: "in" })).toBeTrue();
    expect(connection.isActive()).toBeTrue();

    const disabled = connection.withEnabled(false);
    expect(disabled.isActive()).toBeFalse();
    expect(disabled).not.toBe(connection);

    const invalid = connection.withState("invalid");
    expect(invalid.state).toBe("invalid");

    const snap = connection.withCompatibilitySnapshot({ valueTypes: ["json"] });
    expect(snap.compatibilitySnapshot?.valueTypes).toEqual(["json"]);

    const sameById = new WorkflowConnection({
      id: "c1",
      source: { nodeId: "x", portId: "x" },
      target: { nodeId: "y", portId: "y" },
    });
    expect(connection.equals(sameById)).toBeTrue();

    const sameByShape = new WorkflowConnection({
      id: "other",
      source: { nodeId: "a", portId: "out" },
      target: { nodeId: "b", portId: "in" },
      kind: "DATA",
    } as never);
    expect(connection.equals(sameByShape)).toBeTrue();
  });
});
