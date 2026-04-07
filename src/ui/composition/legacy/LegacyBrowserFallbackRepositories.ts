import { InMemoryStudioShellRepository } from "@infrastructure/studio-shell/InMemoryStudioShellRepository";
import { InMemoryWorkflowPersistenceRepository } from "@infrastructure/workflows/InMemoryWorkflowPersistenceRepository";
import { LocalStorageWorkflowRunSummaryRepository } from "@infrastructure/workflows/LocalStorageWorkflowRunSummaryRepository";

let legacyStudioShellRepository: InMemoryStudioShellRepository | undefined;
let legacyWorkflowPersistenceRepository:
  | InMemoryWorkflowPersistenceRepository
  | undefined;
let legacyWorkflowRunSummaryRepository:
  | LocalStorageWorkflowRunSummaryRepository
  | undefined;

export function resolveLegacyBrowserStudioShellRepository(): InMemoryStudioShellRepository {
  if (!legacyStudioShellRepository) {
    legacyStudioShellRepository = new InMemoryStudioShellRepository();
  }
  return legacyStudioShellRepository;
}

export function resolveLegacyBrowserWorkflowPersistenceRepository(): InMemoryWorkflowPersistenceRepository {
  if (!legacyWorkflowPersistenceRepository) {
    legacyWorkflowPersistenceRepository =
      new InMemoryWorkflowPersistenceRepository();
  }
  return legacyWorkflowPersistenceRepository;
}

export function resolveLegacyBrowserWorkflowRunSummaryRepository(): LocalStorageWorkflowRunSummaryRepository {
  if (!legacyWorkflowRunSummaryRepository) {
    const storage = typeof window !== "undefined" ? window.localStorage : undefined;
    legacyWorkflowRunSummaryRepository =
      new LocalStorageWorkflowRunSummaryRepository(undefined, storage);
  }
  return legacyWorkflowRunSummaryRepository;
}
