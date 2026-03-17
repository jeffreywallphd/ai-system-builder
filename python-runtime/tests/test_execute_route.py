from fastapi.testclient import TestClient
from app.main import app


def test_execute_node_route_prompt_template() -> None:
    client = TestClient(app)
    response = client.post('/execute/node', json={
        'node_id': 'n1',
        'node_type': 'langchain.prompt_template',
        'properties': {'template': 'Hello {name}'},
        'inputs': {'variables': {'name': 'Loom'}},
    })

    assert response.status_code == 200
    payload = response.json()
    assert payload['outputs']['formatted_prompt'] == 'Hello Loom'
