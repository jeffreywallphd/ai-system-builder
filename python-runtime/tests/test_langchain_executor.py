from app.execution.langchain_executor import LangChainExecutor


def test_text_splitter_generates_chunks() -> None:
    executor = LangChainExecutor()
    result = executor.execute(
        'langchain.text_splitter',
        inputs={'text': 'A' * 120, 'chunk_size': 50, 'chunk_overlap': 10},
        properties={},
    )
    assert len(result['chunks']) >= 2


def test_prompt_template_formats_variables() -> None:
    executor = LangChainExecutor()
    result = executor.execute(
        'langchain.prompt_template',
        inputs={'variables': {'topic': 'workflow orchestration'}},
        properties={'template': 'Explain {topic}.'},
    )
    assert result['prompt'] == 'Explain workflow orchestration.'


def test_llm_chat_returns_deterministic_response() -> None:
    executor = LangChainExecutor()
    result = executor.execute(
        'langchain.llm_chat',
        inputs={'messages': [{'role': 'user', 'content': 'Summarize this graph.'}]},
        properties={'model': 'demo-chat-model'},
    )
    assert result['response'] == '[demo-chat-model] user: Summarize this graph.'


def test_output_parser_removes_prefix() -> None:
    executor = LangChainExecutor()
    result = executor.execute(
        'langchain.output_parser',
        inputs={
            'output_text': 'Final: ```json\nscore: 9\nstatus: ready\n```',
            'schema': {'required': ['score']},
        },
        properties={
            'format': 'key_value',
            'prefix': 'Final:',
            'trimCodeFence': True,
            'coerceNumbers': True,
            'schema': {'type': 'object', 'properties': {'score': {'type': 'number'}}},
        },
    )
    assert result['parsed_output'] == {'score': 9, 'status': 'ready'}
    assert result['raw_output'] == 'Final: ```json\nscore: 9\nstatus: ready\n```'
    assert result['parseReport']['schema']['required'] == ['score']
    assert result['parseReport']['extractedKeys'] == ['score', 'status']


def test_message_history_tracks_session_state() -> None:
    executor = LangChainExecutor()
    first = executor.execute(
        'langchain.message_history',
        inputs={
            'sessionId': 'session-a',
            'seedHistory': [{'role': 'system', 'content': 'You remember prior steps.'}],
            'messages': [{'role': 'user', 'content': 'Hello'}, {'role': 'user', 'content': 'Hello'}],
        },
        properties={'maxMessages': 3, 'seedStrategy': 'on-miss', 'dedupeConsecutive': True},
    )
    second = executor.execute(
        'langchain.message_history',
        inputs={
            'sessionId': 'session-a',
            'messages': [{'role': 'assistant', 'content': 'Hi there'}],
        },
        properties={'maxMessages': 3, 'seedStrategy': 'on-miss', 'dedupeConsecutive': True},
    )

    assert first['history'][0]['role'] == 'system'
    assert second['history'] == [
        {'role': 'system', 'content': 'You remember prior steps.'},
        {'role': 'user', 'content': 'Hello'},
        {'role': 'assistant', 'content': 'Hi there'},
    ]
    assert second['historyState']['storedMessageCount'] == 3


def test_tool_definition_returns_manifest() -> None:
    executor = LangChainExecutor()
    result = executor.execute(
        'langchain.tool_definition',
        inputs={'inputSchema': {'type': 'object', 'properties': {'query': {'type': 'string'}}}},
        properties={
            'toolName': 'search_docs',
            'description': 'Search project documents.',
            'inputSchemaSource': 'merge',
            'inputSchema': {'type': 'object', 'properties': {'limit': {'type': 'number'}}},
            'displayName': 'Search Docs',
            'strictSchema': True,
        },
    )

    assert result['tool']['name'] == 'search_docs'
    assert result['toolManifest']['displayName'] == 'Search Docs'
    assert result['toolManifest']['schemaSource'] == 'merge'
    assert result['tool']['inputSchema']['properties'] == {'query': {'type': 'string'}}


def test_vector_store_upsert_and_similarity_search_return_documents() -> None:
    executor = LangChainExecutor()
    upsert = executor.execute(
        'langchain.vector_store_upsert',
        inputs={'documents': [{'id': 'doc-1', 'text': 'Alpha workflow note', 'metadata': {'source': 'kb'}}]},
        properties={'storeType': 'memory', 'collectionName': 'kb'},
    )
    result = executor.execute(
        'langchain.similarity_search',
        inputs={'query': 'Alpha workflow', 'vectorStore': upsert['vectorStore']},
        properties={'k': 1, 'scoreThreshold': 0},
    )
    assert result['documents'][0]['content'] == 'Alpha workflow note'
    assert result['documents'][0]['text'] == 'Alpha workflow note'
    assert result['documents'][0]['metadata']['source'] == 'kb'


def test_knowledge_base_retriever_supports_similarity_and_thresholds() -> None:
    executor = LangChainExecutor()
    knowledge_base = {
        'id': 'kb-1',
        'storeType': 'memory',
        'collectionName': 'studio',
        'records': [
            {'id': 'doc-1', 'text': 'Workflow graphs connect nodes and ports.', 'metadata': {'source': 'guide'}},
            {'id': 'doc-2', 'text': 'Asset browsers manage saved files.', 'metadata': {'source': 'ui'}},
        ],
    }

    result = executor.execute(
        'langchain.knowledge_base_retriever',
        inputs={'query': 'workflow nodes', 'knowledgeBase': knowledge_base},
        properties={'topK': 2, 'searchType': 'similarity', 'scoreThreshold': 0.5},
    )

    assert [document['id'] for document in result['documents']] == ['doc-1']
    assert result['documents'][0]['text'] == 'Workflow graphs connect nodes and ports.'


def test_retrieval_qa_returns_answer_and_sources() -> None:
    executor = LangChainExecutor()
    knowledge_base = {
        'records': [
            {'id': 'doc-1', 'text': 'AI Loom Studio workflows use nodes, ports, and properties.'},
            {'id': 'doc-2', 'text': 'Knowledge base retrieval returns supporting documents.'},
        ]
    }

    result = executor.execute(
        'langchain.retrieval_qa',
        inputs={
            'query': 'How do workflows work?',
            'knowledgeBase': knowledge_base,
            'model': {'id': 'qa-demo-model'},
        },
        properties={'strategy': 'stuff', 'topK': 2, 'includeSources': True},
    )

    assert result['answer'].startswith('[qa-demo-model]')
    assert len(result['sources']) == 2
    assert result['sources'][0]['metadata']['score'] >= result['sources'][1]['metadata']['score']


def test_chat_prompt_builder_returns_structured_prompt_and_messages() -> None:
    executor = LangChainExecutor()
    result = executor.execute(
        'langchain.chat_prompt_builder',
        inputs={
            'systemMessage': 'You are a helpful workflow assistant.',
            'userMessage': 'Explain retrieval QA.',
            'context': 'Retrieved docs mention sources and answers.',
        },
        properties={'includeContext': True, 'contextLabel': 'Context', 'userLabel': 'Request'},
    )

    assert result['prompt']['type'] == 'chat_prompt_builder'
    assert result['messages'][0]['role'] == 'system'
    assert 'Context:\nRetrieved docs mention sources and answers.' in result['messages'][1]['content']
    assert 'Request:\nExplain retrieval QA.' in result['messages'][1]['content']


def test_context_formatter_and_summarization_support_rag_steps() -> None:
    executor = LangChainExecutor()
    context = executor.execute(
        'langchain.context_formatter',
        inputs={'documents': [{'text': 'Alpha'}, {'text': 'Beta'}]},
        properties={'template': 'Doc {index}: {content}', 'maxLength': 100},
    )
    summary = executor.execute(
        'langchain.summarization',
        inputs={'documents': [{'text': 'Alpha Beta Gamma'}], 'model': 'summary-model'},
        properties={'strategy': 'refine'},
    )
    combined = executor.execute(
        'langchain.combine_summaries',
        inputs={'summaries': ['First summary', 'Second summary']},
        properties={'method': 'reduce'},
    )
    assert context['context'] == 'Doc 1: Alpha\n\nDoc 2: Beta'
    assert summary['summary'].startswith('[summary-model]')
    assert combined['combinedSummary'] == 'First summary Second summary'
