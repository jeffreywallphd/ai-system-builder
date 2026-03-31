/// <reference types="node" />
import { describe, expect, it } from "bun:test";
import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";
import {
  SourceInputKinds,
  type ISourceDirectoryScanner,
  SourceLocatorInputAbstraction,
  SourceLocatorIssueCodes,
  SourceLocatorInputError,
} from "../SourceLocatorInputAbstraction";

async function createTempFixture(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "source-locator-test-"));
  await fs.writeFile(path.join(root, "users.csv"), "name,score\nAda,10\nLin,8", "utf-8");
  await fs.writeFile(path.join(root, "users.json"), JSON.stringify([{ id: "1", name: "Ada" }]), "utf-8");
  await fs.writeFile(path.join(root, "notes.txt"), "alpha\nbeta", "utf-8");
  await fs.mkdir(path.join(root, "nested"), { recursive: true });
  await fs.writeFile(path.join(root, "nested", "photo.jpg"), new Uint8Array([1, 2, 3]));
  return root;
}

describe("SourceLocatorInputAbstraction", () => {
  it("resolves a single local file into a normalized descriptor", async () => {
    const fixture = await createTempFixture();
    const locator = new SourceLocatorInputAbstraction();

    const result = await locator.resolve({
      input: {
        kind: SourceInputKinds.localFile,
        path: path.join(fixture, "users.csv"),
      },
    });

    expect(result.descriptors).toHaveLength(1);
    expect(result.descriptors[0]?.displayName).toBe("users.csv");
    expect(result.descriptors[0]?.extension).toBe(".csv");
    expect(result.issues).toHaveLength(0);
  });

  it("scans local directories through the scanner seam and supports extension filters", async () => {
    const fixture = await createTempFixture();
    const directoryScanner: ISourceDirectoryScanner = {
      scan: async (directoryPath) => Object.freeze([
        path.join(directoryPath, "users.csv"),
        path.join(directoryPath, "users.json"),
        path.join(directoryPath, "notes.txt"),
      ]),
    };
    const locator = new SourceLocatorInputAbstraction({ directoryScanner });

    const result = await locator.resolve({
      input: {
        kind: SourceInputKinds.localDirectory,
        path: fixture,
      },
      config: {
        supportedExtensions: [".csv", ".json"],
      },
    });

    expect(result.descriptors.length).toBe(2);
    expect(result.descriptors.every((entry) => entry.extension === ".csv" || entry.extension === ".json")).toBeTrue();
    expect(result.extensionSummary[".csv"]).toBe(1);
    expect(result.extensionSummary[".json"]).toBe(1);
  });

  it("returns structured issues when directory scanning fails", async () => {
    const fixture = await createTempFixture();
    const directoryScanner: ISourceDirectoryScanner = {
      scan: async () => {
        throw new Error("scanner unavailable");
      },
    };
    const locator = new SourceLocatorInputAbstraction({ directoryScanner });

    const result = await locator.resolve({
      input: {
        kind: SourceInputKinds.localDirectory,
        path: fixture,
      },
    });

    expect(result.descriptors).toHaveLength(0);
    expect(result.issues[0]?.code).toBe(SourceLocatorIssueCodes.unreadablePath);
  });

  it("resolves multiple explicit local files and preserves grouped metadata", async () => {
    const fixture = await createTempFixture();
    const locator = new SourceLocatorInputAbstraction();

    const result = await locator.resolve({
      input: {
        kind: SourceInputKinds.localFiles,
        paths: [path.join(fixture, "users.csv"), path.join(fixture, "users.json")],
        groupId: "group-a",
      },
    });

    expect(result.descriptors).toHaveLength(2);
    expect(result.descriptors.every((entry) => entry.groupId === "group-a")).toBeTrue();
    expect(result.issues).toHaveLength(0);
  });

  it("returns structured unreadable path issues for missing paths", async () => {
    const locator = new SourceLocatorInputAbstraction();

    const result = await locator.resolve({
      input: {
        kind: SourceInputKinds.localFile,
        path: path.join(os.tmpdir(), "source-locator-test-missing.csv"),
      },
    });

    expect(result.descriptors).toHaveLength(0);
    expect(result.issues[0]?.code).toBe(SourceLocatorIssueCodes.unreadablePath);
  });

  it("provides bounded source preview inspection summaries", async () => {
    const fixture = await createTempFixture();
    const locator = new SourceLocatorInputAbstraction();

    const preview = await locator.inspect({
      input: {
        kind: SourceInputKinds.localDirectory,
        path: fixture,
      },
    }, 2);

    expect(preview.totalMatched).toBeGreaterThan(2);
    expect(preview.previewedCount).toBe(2);
    expect(preview.items).toHaveLength(2);
  });

  it("validates request shapes with zod and throws typed errors", async () => {
    const locator = new SourceLocatorInputAbstraction();

    await expect(locator.resolve({
      input: {
        kind: SourceInputKinds.localFiles,
        paths: [],
      },
    })).rejects.toSatisfy((error: unknown) => {
      if (!(error instanceof SourceLocatorInputError)) {
        return false;
      }
      expect(error.issues[0]?.code).toBe(SourceLocatorIssueCodes.invalidConfig);
      return true;
    });
  });

  it("resolves remote references when node runtime is unavailable", async () => {
    const locator = new SourceLocatorInputAbstraction({
      nodeRuntimeLoader: async () => {
        throw new Error("node runtime unavailable");
      },
    });

    const result = await locator.resolve({
      input: {
        kind: SourceInputKinds.remoteFile,
        reference: "https://example.com/samples/users.csv",
      },
    });

    expect(result.descriptors).toHaveLength(1);
    expect(result.descriptors[0]?.displayName).toBe("users.csv");
    expect(result.issues).toHaveLength(0);
  });

  it("reports a structured issue for local files when node runtime is unavailable", async () => {
    const locator = new SourceLocatorInputAbstraction({
      nodeRuntimeLoader: async () => {
        throw new Error("node runtime unavailable");
      },
    });

    const result = await locator.resolve({
      input: {
        kind: SourceInputKinds.localFile,
        path: "C:\\temp\\users.csv",
      },
    });

    expect(result.descriptors).toHaveLength(0);
    expect(result.issues[0]?.code).toBe(SourceLocatorIssueCodes.unreadablePath);
    expect(result.issues[0]?.message).toContain("Node.js filesystem runtime");
  });
});

