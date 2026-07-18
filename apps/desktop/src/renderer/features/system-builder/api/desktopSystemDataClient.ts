import type { SystemDataClient } from "../../../../../../../modules/ui/shared/system-builder";
import type { SystemDataResult } from "../../../../../../../modules/contracts/system-data";
import { getDesktopApi } from "../../../lib/desktopApi";

interface Envelope {
  readonly ok?: boolean;
  readonly value?: unknown;
  readonly error?: { readonly code?: unknown; readonly message?: unknown; readonly details?: unknown };
}

const unavailable = <T,>(message = "System data is unavailable.", code = "unavailable", field?: string): SystemDataResult<T> => ({
  ok: false,
  error: { code, message, ...(field ? { field } : {}) },
});

function unwrap<T>(response: unknown): SystemDataResult<T> {
  if (!response || typeof response !== "object" || Array.isArray(response)) return unavailable("The desktop system-data response was invalid.", "invalid-response");
  const envelope = response as Envelope;
  if (envelope.ok === true) return { ok: true, value: envelope.value as T };
  const details = envelope.error?.details as { field?: unknown } | undefined;
  return unavailable(
    typeof envelope.error?.message === "string" ? envelope.error.message : "The system-data request failed.",
    typeof envelope.error?.code === "string" ? envelope.error.code : "internal",
    typeof details?.field === "string" ? details.field : undefined,
  );
}

export function createDesktopSystemDataClient(): SystemDataClient {
  const api = getDesktopApi();
  return {
    describe: async (input) => typeof api.describeSystemDataForm === "function" ? unwrap(await api.describeSystemDataForm(input)) : unavailable(),
    create: async (input) => typeof api.createSystemDataRecord === "function" ? unwrap(await api.createSystemDataRecord(input)) : unavailable(),
    read: async (input) => typeof api.readSystemDataRecord === "function" ? unwrap(await api.readSystemDataRecord(input)) : unavailable(),
    update: async (input) => typeof api.updateSystemDataRecord === "function" ? unwrap(await api.updateSystemDataRecord(input)) : unavailable(),
    list: async (input) => typeof api.listSystemDataRecords === "function" ? unwrap(await api.listSystemDataRecords(input)) : unavailable(),
    listAudit: async (input) => typeof api.listSystemDataAudit === "function" ? unwrap(await api.listSystemDataAudit(input)) : unavailable(),
  };
}
