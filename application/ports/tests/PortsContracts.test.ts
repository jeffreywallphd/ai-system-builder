import { describe, expect, it } from "bun:test";
import { EnvironmentConfigProvider } from "../EnvironmentConfigProvider";
import { FileStorage, FileStorageEntryInfo, FileStorageReadResult } from "../FileStorage";
import { ModelDownloadHandle, ModelDownloadProgress, ModelDownloadResult, ModelDownloader } from "../ModelDownloader";
import { ModelInstallHandle, ModelInstallProgress, ModelInstallResult, ModelInstaller } from "../ModelInstaller";
import { CompositeNodeCatalogProvider } from "../../nodes/CompositeNodeCatalogProvider";
import { RemoteModelCatalog, RemoteModelCatalogItem, RemoteModelCatalogSearchResult } from "../RemoteModelCatalog";
import { WorkflowExecutionEvent, WorkflowExecutionHandle, WorkflowExecutionProgress, WorkflowExecutionResult, WorkflowExecutor } from "../WorkflowExecutor";
import { WorkflowSerializationResult, WorkflowSerializer } from "../WorkflowSerializer";
import type { IEnvironmentConfigProvider } from "../interfaces/IEnvironmentConfigProvider";
import type { IFileStorage, IFileStorageEntryInfo, IFileStorageReadResult } from "../interfaces/IFileStorage";
import type { IModelDownloadHandle, IModelDownloadProgress, IModelDownloadResult, IModelDownloader } from "../interfaces/IModelDownloader";
import type { IModelInstallHandle, IModelInstallProgress, IModelInstallResult, IModelInstaller } from "../interfaces/IModelInstaller";
import type { INodeCatalogProvider } from "../interfaces/INodeCatalogProvider";
import type { IRemoteModelCatalog, IRemoteModelCatalogItem, IRemoteModelCatalogSearchResult } from "../interfaces/IRemoteModelCatalog";
import type { IWorkflowExecutionEvent, IWorkflowExecutionHandle, IWorkflowExecutionProgress, IWorkflowExecutionResult, IWorkflowExecutor } from "../interfaces/IWorkflowExecutor";
import type { IWorkflowSerializationResult, IWorkflowSerializer } from "../interfaces/IWorkflowSerializer";
import { makeModel, makeWorkflow } from "./testUtils";

describe("Application ports contracts", () => {
  it("concrete implementations satisfy declared interfaces", async () => {
    const envProvider: IEnvironmentConfigProvider = new EnvironmentConfigProvider({ a: "1" });

    const fileStorage: IFileStorage = new FileStorage([]);
    const fileEntry: IFileStorageEntryInfo = new FileStorageEntryInfo({ path: "/x", kind: "file" });
    const fileRead: IFileStorageReadResult = new FileStorageReadResult({ path: "/x", content: new Uint8Array() });

    const downloadProgress: IModelDownloadProgress = new ModelDownloadProgress({ modelId: "m", status: "queued" });
    const downloadResult: IModelDownloadResult = new ModelDownloadResult({ modelId: "m", destination: "/m", status: "completed" });
    const downloadHandle: IModelDownloadHandle = new ModelDownloadHandle({ operationId: "op", request: { model: makeModel(), destination: "/m" }, completionPromise: Promise.resolve(downloadResult) });
    const downloader: IModelDownloader = new ModelDownloader([]);

    const installProgress: IModelInstallProgress = new ModelInstallProgress({ modelId: "m", status: "queued" });
    const installResult: IModelInstallResult = new ModelInstallResult({ model: makeModel(), destination: "/m", status: "completed" });
    const installHandle: IModelInstallHandle = new ModelInstallHandle({ operationId: "op", request: { model: makeModel(), destination: "/m" }, completionPromise: Promise.resolve(installResult) });
    const installer: IModelInstaller = new ModelInstaller({});

    const nodeCatalog: INodeCatalogProvider = new CompositeNodeCatalogProvider({});

    const catalogItem: IRemoteModelCatalogItem = new RemoteModelCatalogItem({ model: makeModel(), provider: "hf" });
    const catalogResult: IRemoteModelCatalogSearchResult = new RemoteModelCatalogSearchResult({ items: [catalogItem] });
    const remoteCatalog: IRemoteModelCatalog = new RemoteModelCatalog([]);

    const execProgress: IWorkflowExecutionProgress = new WorkflowExecutionProgress({ executionId: "e", status: "queued" });
    const execEvent: IWorkflowExecutionEvent = new WorkflowExecutionEvent({ executionId: "e", kind: "workflow-started", status: "queued" });
    const execResult: IWorkflowExecutionResult = new WorkflowExecutionResult({ executionId: "e", status: "completed", outputAssets: [] });
    const execHandle: IWorkflowExecutionHandle = new WorkflowExecutionHandle({ executionId: "e", input: { workflow: makeWorkflow() }, completionPromise: Promise.resolve(execResult) });
    const executor: IWorkflowExecutor = new WorkflowExecutor([]);

    const serializationResult: IWorkflowSerializationResult = new WorkflowSerializationResult({ content: "{}", format: "json" });
    const serializer: IWorkflowSerializer = new WorkflowSerializer([]);

    expect(await envProvider.getString("a")).toBe("1");
    expect(fileStorage).toBeDefined();
    expect(fileEntry.kind).toBe("file");
    expect(fileRead.path).toBe("/x");
    expect(downloadProgress.status).toBe("queued");
    expect(downloadResult.status).toBe("completed");
    expect(downloadHandle.operationId).toBe("op");
    expect(downloader.canDownload({ model: makeModel(), destination: "/m" })).toBeFalse();
    expect(installProgress.status).toBe("queued");
    expect(installResult.status).toBe("completed");
    expect(installHandle.operationId).toBe("op");
    expect(installer.canInstall({ model: makeModel({ source: { type: "local" } as any }), destination: "/m" })).toBeTrue();
    expect(nodeCatalog).toBeDefined();
    expect(catalogResult.items).toHaveLength(1);
    expect(remoteCatalog.supportsProvider("hf")).toBeFalse();
    expect(execProgress.status).toBe("queued");
    expect(execEvent.kind).toBe("workflow-started");
    expect(execHandle.executionId).toBe("e");
    expect(executor.canExecute({ workflow: makeWorkflow() })).toBeFalse();
    expect(serializationResult.format).toBe("json");
    expect(serializer.canSerialize({ format: "json" })).toBeFalse();
  });
});
