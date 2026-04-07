import { isMcpToolId, parseMcpToolId } from "../mcp/McpToolIdentity";

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${field} is required.`);
  }
  return normalized;
}

function normalizeWorkflowToolId(toolId: string): string {
  const parts = toolId.split(":");
  if (parts.length < 2 || parts[0] !== "workflow") {
    throw new Error(`Agent tool id '${toolId}' must use workflow:<capabilityId> format.`);
  }
  const scopedParts = parts.slice(1);
  if (scopedParts.some((part) => !part.trim())) {
    throw new Error(`Agent tool id '${toolId}' is malformed.`);
  }
  if (scopedParts.some((part) => !/^[a-zA-Z0-9._-]+$/.test(part))) {
    throw new Error(`Agent tool id '${toolId}' contains non-canonical workflow segments.`);
  }
  return `workflow:${scopedParts.join(":")}`;
}

export function normalizeAgentToolId(value: string, field = "Agent tool id"): string {
  const normalized = normalizeRequired(value, field);
  if (isMcpToolId(normalized)) {
    return parseMcpToolId(normalized).toolId;
  }
  if (normalized.startsWith("workflow:")) {
    return normalizeWorkflowToolId(normalized);
  }
  throw new Error(`${field} '${normalized}' must use canonical mcp:*:* or workflow:* identity.`);
}

export function isCanonicalAgentToolId(value: string): boolean {
  try {
    normalizeAgentToolId(value);
    return true;
  } catch {
    return false;
  }
}
