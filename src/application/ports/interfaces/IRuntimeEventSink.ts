import type { RuntimeEvent, RuntimeEventCreateParams } from "../../runtime/RuntimeEvent";

export interface IRuntimeEventSink {
  emit(event: RuntimeEventCreateParams | RuntimeEvent): void;
}
