import { InMemoryStudioShellRepository } from "../../infrastructure/studio-shell/InMemoryStudioShellRepository";
import { InMemoryWorkflowPersistenceRepository } from "../../infrastructure/workflows/InMemoryWorkflowPersistenceRepository";

let studioShellRepository: InMemoryStudioShellRepository | undefined;
let workflowPersistenceRepository: InMemoryWorkflowPersistenceRepository | undefined;

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
