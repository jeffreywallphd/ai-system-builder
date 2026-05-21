import {
  createWorkspaceId,
  normalizeRuntimeInventory,
  normalizeRuntimeInventorySourceId,
  normalizeRuntimeProviderAvailabilityStatus,
  type RuntimeInventory,
  type RuntimeInventorySourceKind,
} from "../../../contracts/runtime-readiness";
import type { RuntimeInventoryRepositoryPort } from "../../ports/runtime-readiness";
import type { RuntimeCapabilityInventorySourcePort } from "./runtime-capability-inventory-source.port";
import type { RuntimeCapabilityInventoryOperationResult } from "./runtime-capability-inventory-results";

const sanitizeMessage = (value: unknown): string => {
  const raw = typeof value === "string" ? value : "runtime inventory source unavailable";
  if (/(secret|token|password|api[_-]?key|private[_-]?key|path|stack|trace|command|env|payload)/i.test(raw)) {
    return "runtime inventory source unavailable";
  }
  return raw.slice(0, 160);
};

export class RuntimeCapabilityInventoryService {
  public constructor(
    private readonly repository: RuntimeInventoryRepositoryPort,
    private readonly sources: readonly RuntimeCapabilityInventorySourcePort[] = [],
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  public async refreshInventoryFromSources(request: { targetWorkspaceId: string; sourceKind?: RuntimeInventorySourceKind; sourceId?: string }): Promise<RuntimeCapabilityInventoryOperationResult<{ records: readonly RuntimeInventory[] }>> {
    if (!request.targetWorkspaceId) return { status: "validation-failure", reason: "workspace-required", diagnostics: ["Target workspace is required."] };
    const workspaceId = createWorkspaceId(request.targetWorkspaceId);
    const selected = this.sources.filter((source) => {
      if (request.sourceKind && source.sourceKind !== request.sourceKind) return false;
      if (request.sourceId && source.sourceId !== request.sourceId) return false;
      return true;
    });
    const records: RuntimeInventory[] = [];
    const diagnostics: string[] = [];
    for (const source of selected) {
      try {
        const result = await source.collectRuntimeInventory({ targetWorkspaceId: workspaceId });
        const normalized = normalizeRuntimeInventory({ ...result, checkedAt: result.checkedAt ?? this.now(), inventoryStatus: result.inventoryStatus ?? (result.blockers.length > 0 ? "blocked" : "checked") });
        const saved = await this.repository.saveRuntimeInventoryRecord(normalized);
        records.push(saved);
      } catch (error) {
        diagnostics.push(`source ${source.sourceId}: ${sanitizeMessage(error instanceof Error ? error.message : error)}`);
      }
    }
    if (records.length === 0 && diagnostics.length > 0) return { status: "unavailable", reason: "sources-failed", diagnostics };
    if (diagnostics.length > 0) return { status: "partial-success", value: { records }, diagnostics };
    return { status: "success", value: { records }, diagnostics };
  }

  public async listRuntimeInventory(request: Parameters<RuntimeInventoryRepositoryPort["listRuntimeInventoryRecords"]>[0]): Promise<RuntimeCapabilityInventoryOperationResult<{ records: readonly RuntimeInventory[]; nextCursor?: string }>> {
    if (!request?.targetWorkspaceId) return { status: "validation-failure", reason: "workspace-required", diagnostics: ["Target workspace is required."] };
    const normalized = { ...request, targetWorkspaceId: createWorkspaceId(request.targetWorkspaceId), providerAvailabilityStatus: request.providerAvailabilityStatus ? normalizeRuntimeProviderAvailabilityStatus(request.providerAvailabilityStatus) : undefined };
    const result = await this.repository.listRuntimeInventoryRecords(normalized);
    return { status: "success", value: result, diagnostics: [] };
  }

  public async readRuntimeInventory(request: { targetWorkspaceId: string; inventorySourceId: string }): Promise<RuntimeCapabilityInventoryOperationResult<{ record: RuntimeInventory }>> {
    if (!request.targetWorkspaceId) return { status: "validation-failure", reason: "workspace-required", diagnostics: ["Target workspace is required."] };
    const record = await this.repository.readRuntimeInventoryRecord(createWorkspaceId(request.targetWorkspaceId), normalizeRuntimeInventorySourceId(request.inventorySourceId));
    if (!record) return { status: "not-found", reason: "inventory-not-found", diagnostics: [] };
    return { status: "success", value: { record }, diagnostics: [] };
  }
}
