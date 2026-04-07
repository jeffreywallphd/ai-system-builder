import { describe, expect, it } from "bun:test";
import { WorkflowRepository } from "../ports/WorkflowRepository";
import { SaveWorkflowUseCase } from "../workflows/SaveWorkflowUseCase";
import { LoadWorkflowUseCase } from "../workflows/LoadWorkflowUseCase";
import { CreateWorkflowUseCase } from "../workflows/CreateWorkflowUseCase";
import { InstalledModelCatalog } from "../ports/InstalledModelCatalog";
import { InstallModelUseCase } from "../models/InstallModelUseCase";
import { RemoveModelUseCase } from "../models/RemoveModelUseCase";
import { ListInstalledModelsUseCase } from "../models/ListInstalledModelsUseCase";
import { makeModel, makeWorkflow } from "@domain/services/tests/testUtils";
import type { IWorkflow } from "@domain/workflows/interfaces/IWorkflow";
import type {
  IWorkflowRecordSummary,
  IWorkflowRepository,
} from "../ports/interfaces/IWorkflowRepository";
import type { IInstalledModelCatalog } from "../ports/interfaces/IInstalledModelCatalog";
import type {
  IModelInstallHandle,
  IModelInstallRequest,
  IModelInstallResult,
  IModelInstaller,
  IModelUninstallRequest,
} from "../ports/interfaces/IModelInstaller";

class InMemoryWorkflowRepository implements IWorkflowRepository {
  private readonly records = new Map<string, IWorkflow>();
  private readonly summaries = new Map<string, IWorkflowRecordSummary>();

  constructor(initial: ReadonlyArray<IWorkflowRecordSummary> = []) {
    for (const summary of initial) {
      this.summaries.set(summary.id, summary);
    }
  }

  async save(workflow: IWorkflow): Promise<IWorkflow> {
    this.records.set(workflow.id, workflow);
    this.summaries.set(workflow.id, {
      id: workflow.id,
      metadata: workflow.metadata,
      status: workflow.status,
      isEnabled: workflow.isEnabled,
      updatedAt: new Date(),
    });
    return workflow;
  }

  async load(id: string): Promise<IWorkflow | undefined> {
    return this.records.get(id);
  }

  async delete(id: string): Promise<void> {
    this.records.delete(id);
    this.summaries.delete(id);
  }

  async exists(id: string): Promise<boolean> {
    return this.records.has(id);
  }

  async list(): Promise<ReadonlyArray<IWorkflowRecordSummary>> {
    return [...this.summaries.values()];
  }
}

function makeInstaller(): IModelInstaller {
  return {
    startInstall: async (request: IModelInstallRequest): Promise<IModelInstallHandle> => ({
      operationId: `op-${request.model.id}`,
      request,
      getProgress: async () => ({ modelId: request.model.id, status: "completed" }),
      waitForCompletion: async () => ({
        model: request.model,
        destination: request.destination,
        installedLocation: `${request.destination}/${request.model.id}.bin`,
        status: "completed",
      }),
      cancel: async () => undefined,
    }),
    install: async (request: IModelInstallRequest): Promise<IModelInstallResult> => ({
      model: request.model,
      destination: request.destination,
      installedLocation: `${request.destination}/${request.model.id}.bin`,
      status: "completed",
    }),
    canInstall: () => true,
    isInstalled: async () => false,
    uninstall: async (_request: IModelUninstallRequest) => undefined,
    canUninstall: () => true,
  };
}

describe("Application cross-subfolder interactions", () => {
  it("persists and loads workflows through workflow use cases and the repository aggregator", async () => {
    const create = new CreateWorkflowUseCase(() => "wf-app-1");
    const created = create.execute({ metadata: { name: "App workflow" } });

    const primary = new InMemoryWorkflowRepository();
    const secondary = new InMemoryWorkflowRepository([
      {
        id: "wf-app-1",
        metadata: makeWorkflow({ id: "wf-app-1" }).metadata,
        status: "active",
        isEnabled: true,
        updatedAt: new Date("2020-01-01T00:00:00.000Z"),
      },
    ]);

    const repository = new WorkflowRepository([primary, secondary]);

    const saved = await new SaveWorkflowUseCase(repository).execute({
      workflow: created.workflow,
      validateBeforeSave: false,
    });

    const loaded = await new LoadWorkflowUseCase(repository).execute({
      workflowId: "  wf-app-1  ",
      validateOnLoad: false,
    });

    expect(saved.workflow.id).toBe("wf-app-1");
    expect(loaded.workflow?.id).toBe("wf-app-1");
    expect(await repository.exists("wf-app-1")).toBeTrue();
  });

  it("installs, lists, and removes models using model use cases with the installed model catalog", async () => {
    const writableCatalog: IInstalledModelCatalog = {
      listInstalled: async () => [],
      getInstalledById: async () => undefined,
      saveInstalled: async () => undefined,
      removeInstalled: async () => true,
      isInstalled: async () => false,
    };

    const localStore = new Map<string, ReturnType<typeof makeModel>>();
    const memoryCatalog: IInstalledModelCatalog = {
      listInstalled: async () => [...localStore.values()],
      getInstalledById: async (id) => localStore.get(id.trim()),
      saveInstalled: async (model) => {
        localStore.set(model.id, model as ReturnType<typeof makeModel>);
      },
      removeInstalled: async (id) => localStore.delete(id.trim()),
      isInstalled: async (id) => localStore.has(id.trim()),
    };

    const installedCatalog = new InstalledModelCatalog({
      catalogs: [memoryCatalog, writableCatalog],
      writableCatalog: memoryCatalog,
    });

    const model = makeModel("vision-1");
    const installer = makeInstaller();

    await new InstallModelUseCase({
      modelInstaller: installer,
      installedModelCatalog: installedCatalog,
    }).execute({ model, destination: "/models" });

    const listed = await new ListInstalledModelsUseCase(installedCatalog).execute();
    expect(listed.models.map((item) => item.id)).toContain("vision-1");

    const removed = await new RemoveModelUseCase({
      installedModelCatalog: installedCatalog,
      modelInstaller: installer,
    }).execute({ modelId: "vision-1" });

    expect(removed.removed).toBeTrue();
    expect(await installedCatalog.isInstalled("vision-1")).toBeFalse();
  });
});

