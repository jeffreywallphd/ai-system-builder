from __future__ import annotations

import json
from typing import Any, Dict, List

from app.mcp.models import McpToolExecutionRequest
from app.mcp.service import McpService

from .langchain_executor import LangChainExecutor


class NodeDispatcher:
    def __init__(
        self,
        langchain_executor: LangChainExecutor | None = None,
        mcp_service: McpService | None = None,
    ) -> None:
        self._langchain_executor = langchain_executor or LangChainExecutor(mcp_service=mcp_service)
        self._mcp_service = mcp_service

    def dispatch(self, node_type: str, *, inputs: Dict[str, Any], properties: Dict[str, Any]) -> Dict[str, Any]:
        if node_type.startswith("langchain."):
            return self._langchain_executor.execute(node_type, inputs=inputs, properties=properties)

        if node_type == "mcp.tool_catalog":
            return self._dispatch_mcp_tool_catalog()

        if node_type == "mcp.tool_call":
            return self._dispatch_mcp_tool_call(inputs=inputs, properties=properties)

        return {"inputs": inputs, "properties": properties, "note": "default passthrough"}

    def _dispatch_mcp_tool_catalog(self) -> Dict[str, Any]:
        service = self._require_mcp_service()
        response = service.list_tools()

        return {
            "tools": [tool.model_dump(by_alias=True) for tool in response.tools],
            "toolCount": len(response.tools),
            "status": response.status.model_dump(by_alias=True),
            "capabilities": dict(response.capabilities),
        }

    def _dispatch_mcp_tool_call(self, *, inputs: Dict[str, Any], properties: Dict[str, Any]) -> Dict[str, Any]:
        service = self._require_mcp_service()
        tool_value = inputs.get("tool")
        descriptor = self._coerce_tool_descriptor(tool_value)
        arguments = self._coerce_arguments(inputs.get("arguments"))
        server_id = (
            self._normalize_string(inputs.get("serverId"))
            or self._normalize_string(descriptor.get("serverId"))
            or self._normalize_string(descriptor.get("server_id"))
            or self._normalize_string(properties.get("serverId"))
        )
        tool_name = (
            self._tool_name_from_value(tool_value)
            or self._normalize_string(properties.get("toolName"))
        )

        if not server_id:
            raise ValueError("MCP tool execution requires a serverId or descriptor.serverId.")

        if not tool_name:
            raise ValueError("MCP tool execution requires a tool name or descriptor.")

        result = service.execute_tool(
            McpToolExecutionRequest(
                server_id=server_id,
                tool_name=tool_name,
                arguments=arguments,
            )
        )
        structured_content = dict(result.structured_content)

        return {
            "result": result.model_dump(by_alias=True),
            "content": [dict(item) for item in result.content],
            "structuredContent": structured_content,
            "resultText": self._result_text(result.content, structured_content, result.error_message),
            "status": result.status,
            "errorMessage": result.error_message,
        }

    def _require_mcp_service(self) -> McpService:
        if self._mcp_service is None:
            raise ValueError("MCP runtime service is unavailable.")

        return self._mcp_service

    def _coerce_tool_descriptor(self, value: Any) -> Dict[str, Any]:
        if isinstance(value, list):
            for item in value:
                if isinstance(item, dict):
                    return item
            return {}

        return value if isinstance(value, dict) else {}

    def _coerce_arguments(self, value: Any) -> Dict[str, Any]:
        return value if isinstance(value, dict) else {}

    def _tool_name_from_value(self, value: Any) -> str | None:
        if isinstance(value, str):
            return self._normalize_string(value)

        if isinstance(value, list):
            for item in value:
                name = self._tool_name_from_value(item)
                if name:
                    return name
            return None

        if isinstance(value, dict):
            return self._normalize_string(value.get("name")) or self._normalize_string(value.get("toolName"))

        return None

    def _result_text(self, content: List[Dict[str, Any]], structured_content: Dict[str, Any], error_message: str | None) -> str:
        text_parts = [item.get("text") for item in content if isinstance(item.get("text"), str)]
        if text_parts:
            return "\n".join(text_parts)

        if structured_content:
            return json.dumps(structured_content, sort_keys=True)

        return error_message or ""

    def _normalize_string(self, value: Any) -> str | None:
        if not isinstance(value, str):
            return None

        normalized = value.strip()
        return normalized or None
