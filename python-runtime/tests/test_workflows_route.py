from fastapi.testclient import TestClient
from app.main import app


def test_workflows_capabilities_contract() -> None:
    client = TestClient(app)
    response = client.get('/workflows/capabilities')
    assert response.status_code == 200

    payload = response.json()
    assert payload['supports_workflow_execution'] is True
    assert isinstance(payload['supported_node_types'], list)
    assert 'langchain.context_merger' in payload['supported_node_types']
    assert 'langchain.output_parser' in payload['supported_node_types']
    assert 'langchain.message_history' in payload['supported_node_types']
    assert 'langchain.tool_definition' in payload['supported_node_types']
    assert 'langchain.vector_store_upsert' in payload['supported_node_types']
    assert 'langchain.combine_summaries' in payload['supported_node_types']
