export interface McpToolIdentity {
  readonly toolId: string;
  readonly serverId: string;
  readonly toolName: string;
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${field} is required.`);
  }
  return normalized;
}

export function buildMcpToolId(serverId: string, toolName: string): string {
  return `mcp:${encodeURIComponent(normalizeRequired(serverId, "MCP tool serverId"))}:${encodeURIComponent(normalizeRequired(toolName, "MCP tool toolName"))}`;
}

export function parseMcpToolId(toolId: string): McpToolIdentity {
  const normalized = normalizeRequired(toolId, "MCP tool id");
  const parts = normalized.split(":");
  if (parts.length !== 3 || parts[0] !== "mcp") {
    throw new Error(`MCP tool id '${normalized}' must use mcp:<serverId>:<toolName> format.`);
  }

  const serverId = decodeURIComponent(normalizeRequired(parts[1] ?? "", "MCP tool id serverId"));
  const toolName = decodeURIComponent(normalizeRequired(parts[2] ?? "", "MCP tool id toolName"));

  return Object.freeze({
    toolId: buildMcpToolId(serverId, toolName),
    serverId,
    toolName,
  });
}

export function isMcpToolId(toolId: string): boolean {
  return toolId.trim().startsWith("mcp:");
}
