import uuid
from typing import Any

from app.core.mcp_config import McpServerConfig
from app.mcp.models import McpServerDescriptor, McpToolDescriptor, McpToolExecutionRequest, McpToolExecutionResult


class McpConnectionError(RuntimeError):
    pass


class BoundedMcpClient:
    def __init__(self, server: McpServerConfig) -> None:
        self._server = server
        self._connected = False
        self._last_error: str | None = None

    @property
    def is_connected(self) -> bool:
        return self._connected

    def connect(self, force: bool = False) -> McpServerDescriptor:
        if force:
            self._connected = False
            self._last_error = None

        if self._server.fail_connect:
            self._connected = False
            self._last_error = f"Unable to connect to MCP server '{self._server.id}'."
            raise McpConnectionError(self._last_error)

        self._connected = True
        self._last_error = None
        return self.describe(status="connected")

    def disconnect(self) -> McpServerDescriptor:
        self._connected = False
        self._last_error = None
        return self.describe(status="disconnected")

    def describe(self, status: str | None = None, error_message: str | None = None) -> McpServerDescriptor:
        tools = self.list_tools(allow_disconnected=True)
        resources = list(self._server.mock_resources)
        effective_error = error_message or self._last_error
        derived_status = status or ("error" if effective_error else ("connected" if self._connected else "disconnected"))
        return McpServerDescriptor(
            id=self._server.id,
            name=self._server.name,
            transport=self._server.transport,
            status=derived_status,
            tool_count=len(tools),
            resource_count=len(resources),
            capabilities={
                "tools": bool(tools),
                "resources": bool(resources),
                "toolExecution": bool(tools),
            },
            metadata={**self._server.metadata},
            error_message=effective_error,
        )

    def list_tools(self, allow_disconnected: bool = False) -> list[McpToolDescriptor]:
        if not allow_disconnected and not self._connected:
            self.connect()

        descriptors: list[McpToolDescriptor] = []
        for tool in self._server.mock_tools:
            descriptors.append(
                McpToolDescriptor(
                    server_id=self._server.id,
                    name=str(tool.get("name", "tool")),
                    title=tool.get("title"),
                    description=tool.get("description"),
                    input_schema=tool.get("inputSchema", {"type": "object"}),
                    output_schema=tool.get("outputSchema", {}),
                    annotations=tool.get("annotations", {}),
                    metadata=tool.get("metadata", {}),
                )
            )
        return descriptors

    def list_resources(self) -> list[dict[str, Any]]:
        if not self._connected:
            self.connect()
        return [dict(resource) for resource in self._server.mock_resources]

    def execute_tool(self, request: McpToolExecutionRequest) -> McpToolExecutionResult:
        if not self._connected:
            self.connect()

        tool_name = request.tool_name.strip()
        args = dict(request.arguments)
        execution_id = request.execution_id or f"mcp-{uuid.uuid4().hex[:10]}"

        if tool_name == "echo":
            return McpToolExecutionResult(
                execution_id=execution_id,
                server_id=self._server.id,
                tool_name=tool_name,
                status="completed",
                content=[{"type": "json", "json": args}],
                structured_content={"echo": args},
                metadata={"transport": self._server.transport},
            )

        if tool_name == "sum_numbers":
            numbers = args.get("numbers", [])
            if not isinstance(numbers, list) or not all(isinstance(value, (int, float)) for value in numbers):
                return McpToolExecutionResult(
                    execution_id=execution_id,
                    server_id=self._server.id,
                    tool_name=tool_name,
                    status="failed",
                    content=[],
                    structured_content={},
                    error_message="sum_numbers requires a numeric 'numbers' array.",
                )

            total = sum(numbers)
            return McpToolExecutionResult(
                execution_id=execution_id,
                server_id=self._server.id,
                tool_name=tool_name,
                status="completed",
                content=[{"type": "text", "text": str(total)}],
                structured_content={"total": total},
                metadata={"count": len(numbers)},
            )

        available = {tool.name for tool in self.list_tools(allow_disconnected=True)}
        if tool_name not in available:
            raise ValueError(f"Unknown MCP tool '{tool_name}' for server '{self._server.id}'.")

        return McpToolExecutionResult(
            execution_id=execution_id,
            server_id=self._server.id,
            tool_name=tool_name,
            status="completed",
            content=[{"type": "json", "json": args}],
            structured_content={"arguments": args},
        )
