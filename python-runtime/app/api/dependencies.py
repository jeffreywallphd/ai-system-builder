from functools import lru_cache

from app.core.mcp_config import load_mcp_runtime_config
from app.execution.node_dispatcher import NodeDispatcher
from app.execution.workflow_executor import WorkflowExecutor
from app.mcp.registry import McpRegistry
from app.mcp.service import McpService
from app.mcp.session import McpSessionManager
from app.services.health_service import HealthService
from app.services.runtime_service import RuntimeService


@lru_cache
def get_health_service() -> HealthService:
    return HealthService()


@lru_cache
def get_runtime_service() -> RuntimeService:
    dispatcher = NodeDispatcher()
    workflow_executor = WorkflowExecutor(dispatcher)
    return RuntimeService(dispatcher=dispatcher, workflow_executor=workflow_executor)


@lru_cache
def get_mcp_service() -> McpService:
    config = load_mcp_runtime_config()
    registry = McpRegistry(config)
    sessions = McpSessionManager(registry)
    return McpService(registry=registry, sessions=sessions)
