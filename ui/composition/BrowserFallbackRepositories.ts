import { InMemoryStudioShellRepository } from "../../infrastructure/studio-shell/InMemoryStudioShellRepository";
import { InMemoryWorkflowPersistenceRepository } from "../../infrastructure/workflows/InMemoryWorkflowPersistenceRepository";
import { LocalStorageWorkflowRunSummaryRepository } from "../../infrastructure/workflows/LocalStorageWorkflowRunSummaryRepository";

let studioShellRepository: InMemoryStudioShellRepository | undefined;
let workflowPersistenceRepository: InMemoryWorkflowPersistenceRepository | undefined;
let workflowRunSummaryRepository: LocalStorageWorkflowRunSummaryRepository | undefined;

export function resolveBrowserStudioShellRepository(): InMemoryStudioShellRepository {
  if (!studioShellRepository) {
    studioShellRepository = new InMemoryStudioShellRepository();
  }
  return studioShellRepository;
}

export function resolveBrowserWorkflowPersistenceRepository(): InMemoryWorkflowPersistenceRepository {
  if (!workflowPersistenceRepository) {
    workflowPersistenceRepository = new InMemoryWorkflowPersistenceRepository();
  }
  return workflowPersistenceRepository;
}

export function resolveBrowserWorkflowRunSummaryRepository(): LocalStorageWorkflowRunSummaryRepository {
  if (!workflowRunSummaryRepository) {
    const storage = typeof window !== "undefined" ? window.localStorage : undefined;
    workflowRunSummaryRepository = new LocalStorageWorkflowRunSummaryRepository(undefined, storage);
  }
  return workflowRunSummaryRepository;
}
