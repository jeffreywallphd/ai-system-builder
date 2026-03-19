from __future__ import annotations

import json
from typing import Any, Dict, List

from langchain_core.documents import Document as LangChainDocument
from langchain_core.prompts import ChatPromptTemplate, PromptTemplate
from langchain_text_splitters import RecursiveCharacterTextSplitter

try:
    from langchain.chains.summarize import load_summarize_chain  # type: ignore
except Exception:  # pragma: no cover - optional dependency in this runtime image
    load_summarize_chain = None


class _DeterministicVectorStore:
    def __init__(self) -> None:
        self._documents: List[LangChainDocument] = []

    def add_documents(self, documents: List[LangChainDocument]) -> List[str]:
        self._documents.extend(documents)
        return [str(index + 1) for index in range(len(documents))]

    def similarity_search(self, query: str, k: int = 4) -> List[LangChainDocument]:
        query_tokens = {token for token in query.lower().split() if token}
        scored: List[tuple[float, LangChainDocument]] = []
        for document in self._documents:
            candidate_tokens = {token for token in document.page_content.lower().split() if token}
            score = 0.0 if not query_tokens else len(query_tokens & candidate_tokens) / len(query_tokens)
            scored.append((score, document))
        scored.sort(key=lambda item: item[0], reverse=True)
        return [document for score, document in scored[:k] if score > 0 or not query_tokens]


def _normalize_document(item: Any, default_id: str) -> Dict[str, Any]:
    if isinstance(item, str):
        return {"id": default_id, "content": item, "metadata": {}}
    if isinstance(item, dict):
        content = item.get("content") or item.get("text") or item.get("page_content") or ""
        metadata = item.get("metadata") if isinstance(item.get("metadata"), dict) else {}
        return {
            "id": str(item.get("id") or default_id),
            "content": str(content),
            "metadata": metadata,
        }
    return {"id": default_id, "content": str(item), "metadata": {}}


def _normalize_documents(value: Any) -> List[Dict[str, Any]]:
    if not isinstance(value, list):
        return []
    return [_normalize_document(item, f"doc-{index + 1}") for index, item in enumerate(value)]


def _serialize_document(
    *,
    document_id: str,
    text: str,
    metadata: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    normalized_metadata = dict(metadata or {})
    return {
        "id": document_id,
        "text": text,
        "content": text,
        "metadata": normalized_metadata,
    }


def _normalize_knowledge_base_handle(value: Any) -> Dict[str, Any]:
    if isinstance(value, dict):
        records = value.get("records")
        if isinstance(records, list):
            return {
                "id": value.get("id"),
                "storeType": value.get("storeType") or value.get("store_type") or "memory",
                "collectionName": value.get("collectionName") or value.get("collection_name") or "default",
                "records": _normalize_documents(records),
                "metadata": value.get("metadata") if isinstance(value.get("metadata"), dict) else {},
            }

        documents = value.get("documents")
        if isinstance(documents, list):
            return {
                "id": value.get("id"),
                "storeType": value.get("storeType") or "memory",
                "collectionName": value.get("collectionName") or "default",
                "records": _normalize_documents(documents),
                "metadata": value.get("metadata") if isinstance(value.get("metadata"), dict) else {},
            }

    if isinstance(value, list):
        return {
            "id": None,
            "storeType": "memory",
            "collectionName": "default",
            "records": _normalize_documents(value),
            "metadata": {},
        }

    return {
        "id": None,
        "storeType": "memory",
        "collectionName": "default",
        "records": [],
        "metadata": {},
    }


def _score_text(query: str, text: str) -> float:
    query_tokens = {token for token in query.lower().split() if token}
    candidate_tokens = {token for token in text.lower().split() if token}
    if not query_tokens:
        return 0.0
    return len(query_tokens & candidate_tokens) / len(query_tokens)


def _select_documents_by_mmr(
    query: str, documents: List[Dict[str, Any]], k: int
) -> List[Dict[str, Any]]:
    if len(documents) <= 1:
        return documents[:k]

    selected: List[Dict[str, Any]] = []
    remaining = documents[:]
    while remaining and len(selected) < k:
        best_document = None
        best_score = float("-inf")
        for candidate in remaining:
            relevance = float(candidate["metadata"].get("score", _score_text(query, candidate["text"])))
            diversity_penalty = 0.0
            if selected:
                diversity_penalty = max(
                    _score_text(candidate["text"], chosen["text"]) for chosen in selected
                )
            mmr_score = (0.7 * relevance) - (0.3 * diversity_penalty)
            if mmr_score > best_score:
                best_score = mmr_score
                best_document = candidate
        if best_document is None:
            break
        selected.append(best_document)
        remaining.remove(best_document)
    return selected


def _retrieve_documents(
    *,
    query: str,
    handle: Any,
    top_k: int,
    search_type: str = "similarity",
    score_threshold: float | None = None,
) -> List[Dict[str, Any]]:
    normalized_handle = _normalize_knowledge_base_handle(handle)
    scored_documents: List[Dict[str, Any]] = []
    for index, record in enumerate(normalized_handle["records"]):
        score = _score_text(query, record["content"])
        metadata = {**record["metadata"], "score": score}
        scored_documents.append(
            _serialize_document(
                document_id=str(record.get("id") or f"doc-{index + 1}"),
                text=record["content"],
                metadata=metadata,
            )
        )

    filtered_documents = [
        document
        for document in sorted(
            scored_documents,
            key=lambda item: float(item["metadata"].get("score", 0)),
            reverse=True,
        )
        if score_threshold is None or float(document["metadata"].get("score", 0)) >= score_threshold
    ]

    if search_type == "mmr":
        return _select_documents_by_mmr(query, filtered_documents, top_k)

    return filtered_documents[:top_k]


def _resolve_model_label(model: Any) -> str:
    if isinstance(model, str) and model.strip():
        return model
    if isinstance(model, dict):
        for key in ("id", "name", "model", "identifier"):
            value = model.get(key)
            if isinstance(value, str) and value.strip():
                return value
    return "retrieval-qa-model"


class _DeterministicLlm:
    def __init__(self, label: str) -> None:
        self.label = label

    def invoke(self, prompt: Any, **_: Any) -> str:
        text = prompt if isinstance(prompt, str) else str(prompt)
        return f"[{self.label}] {text[:300]}"

    def __call__(self, *args: Any, **kwargs: Any) -> str:
        prompt = args[0] if args else kwargs.get("input") or ""
        return self.invoke(prompt)


class LangChainExecutor:
    def execute(self, node_type: str, *, inputs: Dict[str, Any], properties: Dict[str, Any]) -> Dict[str, Any]:
        if node_type in {"langchain.prompt_template", "langchain.prompt-template"}:
            template = str(properties.get("template") or inputs.get("template") or "{input}")
            variables = dict(inputs.get("variables") or inputs.get("template-input") or properties.get("variables") or {})
            prompt = PromptTemplate.from_template(template)
            formatted = prompt.format(**variables)
            return {"prompt": formatted, "formatted_prompt": formatted}

        if node_type in {"langchain.text_splitter", "langchain.text-splitter"}:
            text = str(inputs.get("text") or properties.get("text") or "")
            chunk_size = int(properties.get("chunkSize") or properties.get("chunk-size") or inputs.get("chunk_size") or 500)
            chunk_overlap = int(properties.get("chunkOverlap") or properties.get("chunk-overlap") or inputs.get("chunk_overlap") or 50)
            splitter = RecursiveCharacterTextSplitter(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
            chunks = splitter.split_text(text)
            return {"chunks": chunks}

        if node_type == "langchain.document_to_chunks":
            documents = _normalize_documents(inputs.get("documents") or [])
            if not documents:
                text = str(inputs.get("text") or properties.get("text") or "")
                metadata = dict(inputs.get("metadata") or properties.get("metadata") or {})
                documents = [{"id": "doc-1", "content": text, "metadata": metadata}]
            chunk_size = int(properties.get("chunk_size") or properties.get("chunkSize") or 500)
            chunk_overlap = int(properties.get("chunk_overlap") or properties.get("chunkOverlap") or 50)
            splitter = RecursiveCharacterTextSplitter(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
            chunks: List[Dict[str, Any]] = []
            for document in documents:
                for index, chunk in enumerate(splitter.split_text(document["content"])):
                    chunks.append({
                        "index": index,
                        "text": chunk,
                        "metadata": document["metadata"],
                    })
            return {"chunks": chunks}

        if node_type in {"langchain.chat_prompt", "langchain.chat-prompt"}:
            system_prompt = str(inputs.get("system") or properties.get("system") or "")
            user_prompt = str(inputs.get("user") or properties.get("user") or "")
            context_value = inputs.get("context") or properties.get("context") or ""
            history = list(inputs.get("history") or []) if bool(properties.get("includeHistory", properties.get("include-history", True))) else []
            include_context = bool(properties.get("includeContext", True))
            context_text = str(context_value) if include_context else ""
            chat_prompt = ChatPromptTemplate.from_messages([
                ("system", "{system_prompt}"),
                ("human", "{user_prompt}{context_suffix}"),
            ])
            messages = chat_prompt.format_messages(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                context_suffix=f"\n\nContext:\n{context_text}" if context_text else "",
            )
            rendered = [{"role": message.type if message.type != "human" else "user", "content": str(message.content)} for message in messages]
            rendered[1:1] = history
            return {"messages": rendered}

        if node_type == "langchain.chat_prompt_builder":
            system_message = str(inputs.get("systemMessage") or properties.get("systemMessage") or "")
            user_message = str(inputs.get("userMessage") or properties.get("userMessage") or "")
            include_context = bool(properties.get("includeContext", True))
            context_value = inputs.get("context") or properties.get("context") or ""
            context_text = str(context_value) if include_context and context_value else ""
            context_label = str(properties.get("contextLabel") or "Context")
            user_label = str(properties.get("userLabel") or "User")
            template = str(properties.get("template") or "")

            if template:
                user_content = (
                    template
                    .replace("{contextLabel}", context_label)
                    .replace("{context}", context_text)
                    .replace("{userLabel}", user_label)
                    .replace("{userMessage}", user_message)
                    .replace("{systemMessage}", system_message)
                ).strip()
            elif context_text:
                user_content = f"{context_label}:\n{context_text}\n\n{user_label}:\n{user_message}"
            else:
                user_content = f"{user_label}:\n{user_message}"

            messages: List[Dict[str, str]] = []
            if system_message:
                messages.append({"role": "system", "content": system_message})
            messages.append({"role": "user", "content": user_content})

            prompt = {
                "type": "chat_prompt_builder",
                "systemMessage": system_message,
                "userMessage": user_message,
                "context": context_text,
                "messages": messages,
                "renderedPrompt": "\n\n".join(
                    [message["content"] for message in messages if message["content"].strip()]
                ),
            }
            return {"prompt": prompt, "messages": messages}

        if node_type == "langchain.llm_chat":
            prompt = str(inputs.get("prompt") or "")
            messages = list(inputs.get("messages") or [])
            model = str(properties.get("model") or "deterministic-model")
            source = "\n".join(f"{message.get('role', 'user')}: {message.get('content', '')}" for message in messages) if messages else prompt
            return {
                "response": f"[{model}] {source}" if source else "",
                "raw": {
                    "model": model,
                    "temperature": float(properties.get("temperature", 0.7)),
                    "maxTokens": properties.get("maxTokens"),
                    "topP": properties.get("topP"),
                    "inputMode": "messages" if messages else "prompt",
                },
            }

        if node_type == "langchain.simple_chain":
            template = str(properties.get("template") or "Echo chain: {input_text}")
            input_text = str(inputs.get("input_text") or "")
            prompt = PromptTemplate.from_template(template)
            rendered = prompt.format(input_text=input_text)
            return {
                "rendered_prompt": rendered,
                "result": f"deterministic-chain-output::{rendered}",
            }

        if node_type == "langchain.context_merger":
            context_blocks: List[str] = list(inputs.get("context_blocks") or properties.get("context_blocks") or [])
            separator = str(properties.get("separator") or inputs.get("separator") or "\n\n")
            merged_context = separator.join([str(block) for block in context_blocks])
            return {
                "merged_context": merged_context,
                "block_count": len(context_blocks),
            }

        if node_type in {"langchain.output_parser", "langchain.output-parser"}:
            output_text = str(inputs.get("text") or inputs.get("output_text") or properties.get("output_text") or "")
            prefix = str(properties.get("prefix") or inputs.get("prefix") or "")
            normalized = output_text.strip()
            if prefix and normalized.startswith(prefix):
                normalized = normalized[len(prefix):].strip()
            if str(properties.get("format") or "json") == "json":
                try:
                    parsed: Any = json.loads(normalized)
                except Exception:
                    parsed = {"text": normalized}
            else:
                parsed = normalized
            return {
                "parsed": parsed,
                "parsed_output": parsed,
                "raw_output": output_text,
            }

        if node_type == "langchain.vector_store_upsert":
            documents = _normalize_documents(inputs.get("documents") or [])
            store_type = str(properties.get("storeType") or "memory")
            collection_name = str(properties.get("collectionName") or "default")
            vector_store = _DeterministicVectorStore()
            lc_documents = [
                LangChainDocument(page_content=document["content"], metadata=document["metadata"])
                for document in documents
            ]
            vector_store.add_documents(lc_documents)
            return {
                "vectorStore": {
                    "storeType": store_type,
                    "collectionName": collection_name,
                    "records": [
                        _serialize_document(
                            document_id=document["id"],
                            text=document["content"],
                            metadata=document["metadata"],
                        )
                        for document in documents
                    ],
                }
            }

        if node_type == "langchain.similarity_search":
            query = str(inputs.get("query") or "")
            handle = inputs.get("vectorStore") or {}
            threshold_value = properties.get("scoreThreshold")
            threshold = float(threshold_value) if threshold_value not in (None, "") else 0.0
            matches = _retrieve_documents(
                query=query,
                handle=handle,
                top_k=max(1, int(properties.get("k") or 4)),
                score_threshold=threshold,
            )
            return {"documents": matches}

        if node_type == "langchain.knowledge_base_retriever":
            query = str(inputs.get("query") or "")
            threshold_value = properties.get("scoreThreshold")
            score_threshold = (
                float(threshold_value)
                if threshold_value not in (None, "")
                else None
            )
            documents = _retrieve_documents(
                query=query,
                handle=inputs.get("knowledgeBase"),
                top_k=max(1, int(properties.get("topK") or 5)),
                search_type=str(properties.get("searchType") or "similarity"),
                score_threshold=score_threshold,
            )
            return {"documents": documents}

        if node_type == "langchain.retrieval_qa":
            query = str(inputs.get("query") or "")
            model_label = _resolve_model_label(inputs.get("model"))
            strategy = str(properties.get("strategy") or "stuff")
            documents = _retrieve_documents(
                query=query,
                handle=inputs.get("knowledgeBase"),
                top_k=max(1, int(properties.get("topK") or 4)),
                search_type="similarity",
                score_threshold=None,
            )
            context = "\n\n".join(
                f"[Source {index + 1}] {document['text']}"
                for index, document in enumerate(documents)
            )
            system_prompt = str(
                properties.get("systemPrompt")
                or "Answer the question using only the retrieved knowledge when possible."
            )
            qa_prompt = (
                f"{system_prompt}\n\n"
                f"Strategy: {strategy}\n"
                f"Question: {query}\n\n"
                f"Retrieved Context:\n{context}\n\n"
                "Answer:"
            )
            answer = _DeterministicLlm(model_label).invoke(qa_prompt)
            include_sources = bool(properties.get("includeSources", True))
            return {
                "answer": answer,
                "sources": documents if include_sources else [],
            }

        if node_type == "langchain.context_formatter":
            documents = _normalize_documents(inputs.get("documents") or [])
            template = str(properties.get("template") or "[{index}] {content}")
            max_length = max(1, int(properties.get("maxLength") or 2000))
            rendered = [
                template
                .replace("{index}", str(index + 1))
                .replace("{content}", document["content"])
                .replace("{metadata}", json.dumps(document["metadata"], sort_keys=True))
                for index, document in enumerate(documents)
            ]
            return {"context": "\n\n".join(rendered)[:max_length]}

        if node_type == "langchain.summarization":
            documents = _normalize_documents(inputs.get("documents") or [])
            strategy = str(properties.get("strategy") or "stuff")
            model = str(inputs.get("model") or "summary-model")
            lc_documents = [
                LangChainDocument(page_content=document["content"], metadata=document["metadata"])
                for document in documents
            ]
            if load_summarize_chain is not None and documents:
                try:
                    chain = load_summarize_chain(_DeterministicLlm(model), chain_type=strategy)
                    summary = chain.run(lc_documents)
                except Exception:
                    summary = f"[{model}] {strategy} summary: {' '.join(document['content'] for document in documents)[:300]}"
            else:
                summary = f"[{model}] {strategy} summary: {' '.join(document['content'] for document in documents)[:300]}"
            return {"summary": summary}

        if node_type == "langchain.combine_summaries":
            summaries = [str(item) for item in (inputs.get("summaries") or []) if str(item).strip()]
            method = str(properties.get("method") or "concatenate")
            combined = " ".join(summaries) if method == "reduce" else "\n\n".join(summaries)
            return {"combinedSummary": combined}

        raise ValueError(f"Unsupported langchain node type: {node_type}")
