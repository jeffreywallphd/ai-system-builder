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



def test_execute_node_route_context_merger() -> None:
    client = TestClient(app)
    response = client.post('/execute/node', json={
        'node_id': 'n2',
        'node_type': 'langchain.context_merger',
        'properties': {'separator': ' | '},
        'inputs': {'context_blocks': ['a', 'b', 'c']},
    })

    assert response.status_code == 200
    payload = response.json()
    assert payload['outputs']['merged_context'] == 'a | b | c'
    assert payload['outputs']['block_count'] == 3
