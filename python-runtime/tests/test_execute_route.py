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


def test_execute_node_route_retrieval_qa_returns_sources() -> None:
    client = TestClient(app)
    response = client.post('/execute/node', json={
        'node_id': 'n3',
        'node_type': 'langchain.retrieval_qa',
        'properties': {'strategy': 'stuff', 'topK': 2, 'includeSources': True},
        'inputs': {
            'query': 'What is retrieval QA?',
            'knowledgeBase': {
                'records': [
                    {'id': 'doc-1', 'text': 'Retrieval QA finds documents before answering.'},
                    {'id': 'doc-2', 'text': 'Sources can be returned with the answer.'},
                ],
            },
            'model': {'id': 'route-qa-model'},
        },
    })

    assert response.status_code == 200
    payload = response.json()
    assert payload['outputs']['answer'].startswith('[route-qa-model]')
    assert len(payload['outputs']['sources']) == 2


def test_execute_node_route_chat_prompt_builder_returns_prompt_object() -> None:
    client = TestClient(app)
    response = client.post('/execute/node', json={
        'node_id': 'n4',
        'node_type': 'langchain.chat_prompt_builder',
        'properties': {'includeContext': True, 'contextLabel': 'Context', 'userLabel': 'User'},
        'inputs': {
            'systemMessage': 'You are helpful.',
            'userMessage': 'Summarize the workflow.',
            'context': 'The workflow includes retriever and QA nodes.',
        },
    })

    assert response.status_code == 200
    payload = response.json()
    assert payload['outputs']['prompt']['type'] == 'chat_prompt_builder'
    assert payload['outputs']['messages'][0]['role'] == 'system'
