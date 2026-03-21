import type { RuntimeEvent } from "./RuntimeEvent";

export function appendDistinctRuntimeEvent(
  events: ReadonlyArray<RuntimeEvent>,
  nextEvent: RuntimeEvent,
  capacity: number,
): ReadonlyArray<RuntimeEvent> {
  const lastEvent = events.length > 0 ? events[events.length - 1] : undefined;
  if (lastEvent && areRuntimeEventsEquivalent(lastEvent, nextEvent)) {
    return events;
  }

  return Object.freeze([...events, nextEvent].slice(-Math.max(capacity, 1)));
}

export function collapseConsecutiveRuntimeEvents(
  events: ReadonlyArray<RuntimeEvent>,
): ReadonlyArray<RuntimeEvent> {
  const collapsed: RuntimeEvent[] = [];

  for (const event of events) {
    const previous = collapsed.length > 0 ? collapsed[collapsed.length - 1] : undefined;
    if (previous && areRuntimeEventsEquivalent(previous, event)) {
      continue;
    }

    collapsed.push(event);
  }

  return Object.freeze(collapsed);
}

export function areRuntimeEventsEquivalent(left: RuntimeEvent, right: RuntimeEvent): boolean {
  return left.source === right.source
    && left.severity === right.severity
    && left.message === right.message
    && serializeRuntimeEventDetails(left.details) === serializeRuntimeEventDetails(right.details);
}

function serializeRuntimeEventDetails(details: RuntimeEvent["details"]): string {
  if (!details) {
    return "";
  }

  return JSON.stringify(details);
}
