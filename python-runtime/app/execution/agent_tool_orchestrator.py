from __future__ import annotations

import json
import re
from typing import Any, Dict, List, Tuple

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
        tool.get("routingName"),
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
        "routingName": str(tool.get("routingName") or name),
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
        for key in ("id", "capabilityId", "routingName", "name", "displayName"):
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
            str(tool.get("routingName") or "").lower(),
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
        "taskInput": task,
        "capabilityId": tool.get("capabilityId"),
        "displayName": tool.get("displayName"),
        "provider": dict(tool.get("provider") or {}),
        "source": dict(tool.get("source") or {}),
        "status": tool_result.get("status", "completed"),
        "reasoning": f"Selected '{tool.get('displayName') or tool.get('name')}' for task segment {index}.",
        "invocationArguments": dict(executed.get("toolCall", {}).get("arguments") or {}),
        "toolCall": dict(executed.get("toolCall") or {}),
        "result": tool_result,
        "resultText": executed.get("resultText"),
        "errorMessage": tool_result.get("errorMessage"),
    }


def _normalize_selected_tools(
    selected_inputs: Any,
    available_tools: List[Dict[str, Any]],
) -> Tuple[List[Dict[str, Any]], List[str]]:
    if not isinstance(selected_inputs, list):
        return list(available_tools), []

    identifiers: List[str] = []
    direct_tools: List[Dict[str, Any]] = []
    seen_capabilities: set[str] = set()

    for item in selected_inputs:
        identifier = normalize_tool_identifier(item)
        if identifier:
            identifiers.append(identifier)
        normalized = normalize_tool_descriptor(item)
        if normalized is None:
            continue
        capability_id = str(normalized.get("capabilityId") or normalized.get("name") or "").strip()
        if capability_id and capability_id not in seen_capabilities:
            seen_capabilities.add(capability_id)
            direct_tools.append(normalized)

    if not identifiers and not direct_tools:
        return list(available_tools), []

    selected_tools: List[Dict[str, Any]] = []
    seen_selected: set[str] = set()

    for tool in available_tools + direct_tools:
        capability_id = str(tool.get("capabilityId") or tool.get("name") or "").strip()
        if capability_id in seen_selected:
            continue
        candidates = {
            capability_id,
            str(tool.get("name") or "").strip(),
            str(tool.get("displayName") or "").strip(),
            str(tool.get("routingName") or "").strip(),
        }
        if identifiers and not candidates.intersection(identifiers):
            continue
        seen_selected.add(capability_id)
        selected_tools.append(tool)

    if not selected_tools and direct_tools:
        return direct_tools, identifiers

    return selected_tools, identifiers


def run_agent_orchestration(
    *,
    model: str,
    latest_user_input: str,
    tools_input: Any,
    selected_tools_input: Any,
    max_iterations: int,
    temperature: float,
    verbose: bool,
    mcp_service: McpService | None = None,
) -> Dict[str, Any]:
    available_tools = [
        tool for tool in [normalize_tool_descriptor(item) for item in (tools_input or [])] if tool is not None
    ]
    selected_tools, selected_identifiers = _normalize_selected_tools(selected_tools_input, available_tools)
    task_segments = split_task_into_steps(latest_user_input, max_steps=max_iterations)
    tool_calls: List[Dict[str, Any]] = []
    tool_results: List[Dict[str, Any]] = []
    step_results: List[Dict[str, Any]] = []
    chosen_tool_names: List[str] = []
    stopped_reason = "completed"

    for step_index, task_segment in enumerate(task_segments, start=1):
        chosen_tool = pick_tool_for_task(task_segment, selected_tools)
        if chosen_tool is None:
            stopped_reason = "no-tool-selected"
            break

        chosen_tool_names.append(str(chosen_tool.get("name") or ""))
        executed_tool = execute_tool(
            chosen_tool,
            {"input": task_segment},
            mcp_service=mcp_service,
        )
        tool_calls.append(dict(executed_tool["toolCall"]))
        tool_results.append(dict(executed_tool["toolResult"]))
        step_results.append(
            build_step_result(
                index=step_index,
                task=task_segment,
                tool=chosen_tool,
                executed=executed_tool,
            )
        )

        if executed_tool["toolResult"].get("status") != "completed":
            stopped_reason = "tool-failed"
            break

    iteration_count = len(step_results)
    if not step_results and latest_user_input and selected_tools:
        stopped_reason = "no-tool-selected"
    elif task_segments and iteration_count >= max_iterations:
        stopped_reason = "max-iterations-reached"

    if tool_results and latest_user_input:
        observed = "; ".join(
            str(tool_result.get("output") or tool_result.get("errorMessage") or "").strip()
            for tool_result in tool_results
            if str(tool_result.get("output") or tool_result.get("errorMessage") or "").strip()
        )
        response = f"[{model}] {latest_user_input}\n\nUsed {iteration_count} tool step(s): {', '.join(chosen_tool_names)}.\nObserved: {observed}"
    else:
        response = f"[{model}] {latest_user_input}" if latest_user_input else ""

    result: Dict[str, Any] = {
        "response": response,
        "toolCalls": tool_calls,
        "toolResults": tool_results,
        "stepResults": step_results,
        "availableTools": [
            {
                "capabilityId": tool.get("capabilityId"),
                "name": tool.get("name"),
                "displayName": tool.get("displayName"),
                "provider": dict(tool.get("provider") or {}),
                "source": dict(tool.get("source") or {}),
            }
            for tool in available_tools
        ],
        "selectedTools": [
            {
                "capabilityId": tool.get("capabilityId"),
                "name": tool.get("name"),
                "displayName": tool.get("displayName"),
                "provider": dict(tool.get("provider") or {}),
                "source": dict(tool.get("source") or {}),
            }
            for tool in selected_tools
        ],
    }
    if verbose:
        result["trace"] = {
            "temperature": temperature,
            "maxIterations": max_iterations,
            "iterationCount": iteration_count,
            "toolCount": len(available_tools),
            "selectedToolCount": len(selected_tools),
            "selectedTools": [tool.get("name") for tool in selected_tools],
            "selectedToolIdentifiers": selected_identifiers,
            "usedProviderKinds": sorted(
                {
                    str(tool_result.get("provider", {}).get("kind"))
                    for tool_result in tool_results
                    if isinstance(tool_result.get("provider"), dict)
                    and tool_result.get("provider", {}).get("kind")
                }
            ),
            "stoppedReason": stopped_reason,
        }
    return result
