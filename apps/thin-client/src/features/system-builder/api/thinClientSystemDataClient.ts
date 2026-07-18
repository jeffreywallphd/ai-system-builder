import type { SystemDataResult } from "../../../../../../modules/contracts/system-data";
import type { SystemDataClient } from "../../../../../../modules/ui/shared/system-builder";
import { parseApiEnvelope } from "../../../security/apiErrorEnvelope";
import { secureFetch } from "../../../security/secureFetch";

const failure = <T,>(message = "System data is unavailable.", code = "unavailable", field?: string): SystemDataResult<T> => ({
  ok: false,
  error: { code, message, ...(field ? { field } : {}) },
});

async function request<T>(url: string, init?: RequestInit): Promise<SystemDataResult<T>> {
  try {
    const response = await secureFetch(url, init);
    const envelope = parseApiEnvelope(await response.json());
    if (envelope.ok) return { ok: true, value: envelope.value as T };
    const details = envelope.error?.details as { field?: unknown } | undefined;
    return failure(
      envelope.error?.message ?? "The system-data request failed.",
      envelope.error?.code ?? "internal",
      typeof details?.field === "string" ? details.field : undefined,
    );
  } catch {
    return failure();
  }
}

const post = <T,>(url: string, body: unknown) =>
  request<T>(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const query = (input: { workspaceId: string; releaseId: string; entityType: string }) =>
  `workspaceId=${encodeURIComponent(input.workspaceId)}&releaseId=${encodeURIComponent(input.releaseId)}&entityType=${encodeURIComponent(input.entityType)}`;

export function createThinClientSystemDataClient(baseUrl = "/api"): SystemDataClient {
  const root = baseUrl.replace(/\/+$/, "");
  return {
    describe: (input) => request(`${root}/systems/data/form?${query(input)}`),
    create: (input) => post(`${root}/systems/data/records/create`, input),
    read: (input) => request(`${root}/systems/data/record?${query(input)}&recordId=${encodeURIComponent(input.recordId)}`),
    update: (input) => post(`${root}/systems/data/records/update`, input),
    list: (input) => request(`${root}/systems/data/records?${query(input)}${input.limit !== undefined ? `&limit=${input.limit}` : ""}${input.offset !== undefined ? `&offset=${input.offset}` : ""}`),
    listAudit: (input) => request(`${root}/systems/data/audit?${query(input)}${input.limit !== undefined ? `&limit=${input.limit}` : ""}`),
  };
}
