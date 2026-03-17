from typing import Any, Dict
from .langchain_executor import LangChainExecutor


class NodeDispatcher:
    def __init__(self, langchain_executor: LangChainExecutor | None = None) -> None:
        self._langchain_executor = langchain_executor or LangChainExecutor()

    def dispatch(self, node_type: str, *, inputs: Dict[str, Any], properties: Dict[str, Any]) -> Dict[str, Any]:
        if node_type.startswith("langchain."):
            return self._langchain_executor.execute(node_type, inputs=inputs, properties=properties)

        return {"inputs": inputs, "properties": properties, "note": "default passthrough"}
