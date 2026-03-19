from __future__ import annotations

import json
import re
from typing import Any, Dict, List

from app.mcp.models import McpToolExecutionRequest
from app.mcp.service import McpService


def normalize_tool_descriptor(tool: Any) -> Dict[str, Any] | None:
    if not isinstance(tool, dict):
        return None

    provider = tool.get("provider") if isinstance(tool.get("provider"), dict) else {}
    source = tool.get("source") if isinstance(tool.get("source"), dict) else {}
    publication = tool.get("publication") if isinstance(tool.get("publication"), dict) else {}
    metadata = tool.get("metadata") if isinstance(tool.get("metadata"), dict) else {}
    annotations = tool.get("annotations") if isinstance(tool.get("annotations"), dict) else {}
    input_schema = tool.get("inputSchema") if isinstance(tool.get("inputSchema"), dict) else None

    name_candidates = [
        tool.get("name"),
        source.get("toolName"),
        source.get("workflowToolSlug"),
        tool.get("displayName"),
        tool.get("id"),
    ]
    name = next(
        (str(candidate).strip() for candidate in name_candidates if isinstance(candidate, str) and candidate.strip()),
        "",
    )
    if not name:
        return None

    description = next(
        (
            str(candidate)
            for candidate in [
                tool.get("description"),
                publication.get("description"),
                metadata.get("description"),
                "",
            ]
            if isinstance(candidate, str)
        ),
        "",
    )

    return {
        "name": name,
        "displayName": str(tool.get("displayName") or name),
        "capabilityId": str(tool.get("id") or name),
        "description": description,
        "inputSchema": input_schema,
        "strictSchema": tool.get("strictSchema") if isinstance(tool.get("strictSchema"), bool) else None,
        "handler": tool.get("handler"),
        "provider": dict(provider),
        "source": dict(source),
        "publication": dict(publication),
        "metadata": dict(metadata),
        "annotations": dict(annotations),
    }


def normalize_tool_identifier(value: Any) -> str | None:
    if isinstance(value, str):
        normalized = value.strip()
        return normalized or None

    if isinstance(value, dict):
        for key in ("id", "capabilityId", "name", "displayName"):
            candidate = value.get(key)
            if isinstance(candidate, str) and candidate.strip():
                return candidate.strip()

    return None


def required_tool_arguments(tool: Dict[str, Any]) -> List[str]:
    schema = tool.get("inputSchema") if isinstance(tool.get("inputSchema"), dict) else {}
    required = schema.get("required")
    if not isinstance(required, list):
        return []
    return [str(value) for value in required if isinstance(value, str) and value.strip()]


def pick_tool_for_task(task: str, tools: List[Dict[str, Any]]) -> Dict[str, Any] | None:
    if not tools:
        return None

    normalized_task = task.lower()
    for tool in tools:
        names = [
            str(tool.get("name") or "").lower(),
            str(tool.get("displayName") or "").lower(),
            str(tool.get("capabilityId") or "").lower(),
            str(tool.get("source", {}).get("toolName") or "").lower(),
        ]
        if any(name and name in normalized_task for name in names):
            return tool

    for tool in tools:
        description = str(tool.get("description") or "").lower()
        if any(
            keyword in normalized_task and keyword in description
            for keyword in ["search", "find", "lookup", "retrieve", "sum", "echo", "tool"]
        ):
            return tool

    return tools[0]


def split_task_into_steps(task: str, *, max_steps: int) -> List[str]:
    normalized = str(task).strip()
    if not normalized:
        return []

    parts = [
        part.strip(" ,")
        for part in re.split(r"\b(?:and then|then|after that|next)\b|[;\n]+", normalized, flags=re.IGNORECASE)
        if part.strip(" ,")
    ]
    return (parts or [normalized])[:max_steps]


def build_fallback_tool_result(tool: Dict[str, Any], arguments: Dict[str, Any]) -> Dict[str, Any]:
    missing_required_arguments = [
        name for name in required_tool_arguments(tool) if arguments.get(name) in (None, "")
    ]
    primary_input = str(
        arguments.get("input")
        or arguments.get("query")
        or arguments.get("request")
        or arguments.get("text")
        or ""
    ).strip()
    tool_call = {
        "name": tool["name"],
        "arguments": dict(arguments),
        "capabilityId": tool.get("capabilityId"),
        "provider": dict(tool.get("provider") or {}),
        "source": dict(tool.get("source") or {}),
    }
    output = (
        f"{tool['description']} :: {primary_input}"
        if primary_input
        else f"{tool['description']} :: {json.dumps(arguments, sort_keys=True) if arguments else 'no arguments provided'}"
    )
    tool_result = {
        "toolName": tool["name"],
        "displayName": tool.get("displayName"),
        "capabilityId": tool.get("capabilityId"),
        "provider": dict(tool.get("provider") or {}),
        "source": dict(tool.get("source") or {}),
        "arguments": dict(arguments),
        "missingRequiredArguments": missing_required_arguments,
        "status": "missing-required-arguments" if missing_required_arguments else "completed",
        "output": output,
        "content": [{"type": "text", "text": output}],
        "structuredContent": {},
    }
    return {
        "toolCall": tool_call,
        "toolResult": tool_result,
        "resultText": json.dumps(tool_result, sort_keys=True),
        "missingRequiredArguments": missing_required_arguments,
    }


def execute_tool(
    tool: Dict[str, Any],
    arguments: Dict[str, Any],
    *,
    mcp_service: McpService | None = None,
) -> Dict[str, Any]:
    provider = tool.get("provider") if isinstance(tool.get("provider"), dict) else {}
    source = tool.get("source") if isinstance(tool.get("source"), dict) else {}
    if (
        provider.get("kind") == "mcp"
        and isinstance(source.get("serverId"), str)
        and source.get("serverId")
        and mcp_service is not None
    ):
        tool_name = str(source.get("toolName") or tool.get("name") or "").strip()
        result = mcp_service.execute_tool(
            McpToolExecutionRequest(
                server_id=str(source["serverId"]).strip(),
                tool_name=tool_name,
                arguments=dict(arguments),
                execution_id=f"agent-{tool.get('capabilityId') or tool_name}",
                metadata={"origin": "langchain.simple_agent"},
            )
        )
        content = [dict(item) for item in result.content]
        structured_content = dict(result.structured_content)
        text_parts = [item.get("text") for item in content if isinstance(item.get("text"), str)]
        output = "\n".join(text_parts) or (
            json.dumps(structured_content, sort_keys=True)
            if structured_content
            else (result.error_message or "")
        )
        tool_call = {
            "name": tool_name,
            "arguments": dict(arguments),
            "capabilityId": tool.get("capabilityId"),
            "provider": dict(provider),
            "source": dict(source),
        }
        tool_result = {
            "toolName": tool_name,
            "displayName": tool.get("displayName"),
            "capabilityId": tool.get("capabilityId"),
            "provider": dict(provider),
            "source": dict(source),
            "arguments": dict(arguments),
            "missingRequiredArguments": [],
            "status": result.status,
            "output": output,
            "content": content,
            "structuredContent": structured_content,
            "errorMessage": result.error_message,
        }
        return {
            "toolCall": tool_call,
            "toolResult": tool_result,
            "resultText": output,
            "missingRequiredArguments": [],
        }

    return build_fallback_tool_result(tool, arguments)


def build_step_result(
    *,
    index: int,
    task: str,
    tool: Dict[str, Any],
    executed: Dict[str, Any],
) -> Dict[str, Any]:
    tool_result = dict(executed.get("toolResult") or {})
    return {
        "stepIndex": index,
        "task": task,
        "capabilityId": tool.get("capabilityId"),
        "toolName": tool.get("name"),
        "displayName": tool.get("displayName"),
        "provider": dict(tool.get("provider") or {}),
        "source": dict(tool.get("source") or {}),
        "status": tool_result.get("status", "completed"),
        "reasoning": f"Selected '{tool.get('displayName') or tool.get('name')}' for task segment {index}.",
        "toolCall": dict(executed.get("toolCall") or {}),
        "toolResult": tool_result,
        "resultText": executed.get("resultText"),
    }
