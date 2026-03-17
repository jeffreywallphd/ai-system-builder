from fastapi import APIRouter

router = APIRouter(prefix="/workflows", tags=["workflows"])


@router.get("/capabilities")
def get_capabilities() -> dict[str, object]:
    return {
        "supports_workflow_execution": True,
        "supported_node_types": [
            "langchain.prompt_template",
            "langchain.text_splitter",
            "langchain.document_to_chunks",
            "langchain.chat_prompt",
            "langchain.simple_chain",
        ],
    }
