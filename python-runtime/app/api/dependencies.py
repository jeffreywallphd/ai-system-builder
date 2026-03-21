from functools import lru_cache

from app.mcp.provisioning import (
    LocalMcpServerProvisioner,
    build_bootstrapped_mcp_runtime_config,
    resolve_default_mcp_workspace_root,
    resolve_mcp_runtime_python_executable,
)
from app.execution.node_dispatcher import NodeDispatcher
from app.execution.workflow_executor import WorkflowExecutor
from app.mcp.registry import McpRegistry
from app.mcp.service import McpService
from app.mcp.session import McpSessionManager
from app.services.document_conversion_service import DocumentConversionService
from app.services.health_service import HealthService
from app.services.runtime_service import RuntimeService


@lru_cache
def get_health_service() -> HealthService:
    return HealthService()


@lru_cache
def get_mcp_service() -> McpService:
    config = build_bootstrapped_mcp_runtime_config()
    registry = McpRegistry(config)
    sessions = McpSessionManager(registry)
    provisioner = LocalMcpServerProvisioner(
        workspace_root=resolve_default_mcp_workspace_root(),
        python_executable=resolve_mcp_runtime_python_executable(),
    )
    return McpService(registry=registry, sessions=sessions, provisioner=provisioner)


@lru_cache
def get_runtime_service() -> RuntimeService:
    dispatcher = NodeDispatcher(mcp_service=get_mcp_service())
    workflow_executor = WorkflowExecutor(dispatcher)
    return RuntimeService(dispatcher=dispatcher, workflow_executor=workflow_executor)


@lru_cache
def get_document_conversion_service() -> DocumentConversionService:
    return DocumentConversionService()
