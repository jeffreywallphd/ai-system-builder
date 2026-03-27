import { describe, expect, it } from "bun:test";
import { StudioShellExtensionRegistry, StudioShellExtensionSlots } from "../StudioShellExtensions";

describe("StudioShellExtensionRegistry", () => {
  it("registers contributions by slot and sorts by order then id", () => {
    const registry = new StudioShellExtensionRegistry();
    registry.registerMany([
      {
        id: "metadata-z",
        slot: StudioShellExtensionSlots.metadata,
        title: "Metadata Z",
        order: 20,
        render: () => null,
      },
      {
        id: "metadata-a",
        slot: StudioShellExtensionSlots.metadata,
        title: "Metadata A",
        order: 5,
        render: () => null,
      },
      {
        id: "metadata-b",
        slot: StudioShellExtensionSlots.metadata,
        title: "Metadata B",
        render: () => null,
      },
    ]);

    expect(registry.listBySlot(StudioShellExtensionSlots.metadata).map((entry) => entry.id)).toEqual([
      "metadata-a",
      "metadata-z",
      "metadata-b",
    ]);
  });

  it("rejects empty or duplicate extension ids", () => {
    const registry = new StudioShellExtensionRegistry();
    expect(() => registry.register({
      id: "   ",
      slot: StudioShellExtensionSlots.lifecycle,
      title: "Invalid",
      render: () => null,
    })).toThrow("id is required");

    registry.register({
      id: "lifecycle-extra",
      slot: StudioShellExtensionSlots.lifecycle,
      title: "Lifecycle Extra",
      render: () => null,
    });

    expect(() => registry.register({
      id: "lifecycle-extra",
      slot: StudioShellExtensionSlots.lifecycle,
      title: "Duplicate",
      render: () => null,
    })).toThrow("already registered");
  });
});
