import { describe, expect, it } from "bun:test";
import { DataSourceReferenceKinds } from "../DataConverterContracts";
import {
  DataSourceLocatorError,
  DataSourceLocatorErrorCodes,
  DefaultDataSourceLocator,
  type IDataSourcePayloadLoader,
} from "../DataSourceLocator";

describe("DefaultDataSourceLocator", () => {
  it("resolves in-memory sources without a loader", async () => {
    const locator = new DefaultDataSourceLocator();
    const resolved = await locator.resolve({
      source: {
        kind: DataSourceReferenceKinds.inMemory,
        payload: "name,score\\nAda,10",
        fileName: "users.csv",
      },
    });

    expect(resolved.kind).toBe("in-memory");
    expect(resolved.fileName).toBe("users.csv");
    expect(resolved.payload).toBe("name,score\\nAda,10");
  });

  it("resolves local file references using the configured payload loader", async () => {
    class Loader implements IDataSourcePayloadLoader {
      async loadLocalFile(path: string): Promise<string> {
        return path.endsWith("users.csv") ? "name,score\\nAda,10" : "";
      }
      async loadUrl(): Promise<string> {
        throw new Error("unused");
      }
    }

    const locator = new DefaultDataSourceLocator(new Loader());
    const resolved = await locator.resolve({
      source: {
        kind: DataSourceReferenceKinds.localFile,
        path: "C:\\workspace\\users.csv",
      },
    });

    expect(resolved.reference).toBe("C:\\workspace\\users.csv");
    expect(resolved.fileName).toBe("users.csv");
    expect(resolved.formatHint).toBe("csv");
    expect(resolved.payload).toBe("name,score\\nAda,10");
  });

  it("normalizes URL-like source references", async () => {
    const locator = new DefaultDataSourceLocator();
    const resolved = await locator.resolve({
      source: {
        kind: DataSourceReferenceKinds.url,
        url: "https://example.com/items.json?cache=1",
        payload: "[{\"id\":1}]",
      },
    });

    expect(resolved.reference).toBe("https://example.com/items.json?cache=1");
    expect(resolved.fileName).toBe("items.json");
    expect(resolved.formatHint).toBe("json");
  });

  it("emits typed errors when loader-backed source resolution is unavailable", async () => {
    const locator = new DefaultDataSourceLocator();

    await expect(locator.resolve({
      source: {
        kind: DataSourceReferenceKinds.localFile,
        path: "C:\\workspace\\missing.csv",
      },
    })).rejects.toSatisfy((error: unknown) => {
      if (!(error instanceof DataSourceLocatorError)) {
        return false;
      }

      expect(error.code).toBe(DataSourceLocatorErrorCodes.sourceUnavailable);
      expect(error.diagnostics[0]?.code).toBe(DataSourceLocatorErrorCodes.sourceUnavailable);
      return true;
    });
  });

  it("returns invalid-reference diagnostics for malformed source references", async () => {
    const locator = new DefaultDataSourceLocator();

    await expect(locator.resolve({
      source: {
        kind: DataSourceReferenceKinds.url,
        url: " ",
      },
    })).rejects.toSatisfy((error: unknown) => {
      if (!(error instanceof DataSourceLocatorError)) {
        return false;
      }

      expect(error.code).toBe(DataSourceLocatorErrorCodes.invalidReference);
      expect(error.diagnostics[0]?.details?.section).toBe("source-reference");
      return true;
    });
  });
});
