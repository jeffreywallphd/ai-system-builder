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
        inputs={'output_text': 'Final: normalized value'},
        properties={'format': 'text', 'prefix': 'Final:'},
    )
    assert result['parsed_output'] == 'normalized value'
    assert result['raw_output'] == 'Final: normalized value'


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
    assert result['documents'][0]['metadata']['source'] == 'kb'


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
