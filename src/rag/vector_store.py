from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from loguru import logger
import os
from pathlib import Path

PERSIST_DIR = "data/chroma_db"


class FinancialRAG:
    def __init__(self):
        self._embeddings = None
        self._vectorstore = None
        self._chroma_available = None
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
        )

    def _is_chroma_available(self) -> bool:
        if self._chroma_available is None:
            try:
                import chromadb  # noqa: F401
                self._chroma_available = True
            except ImportError:
                self._chroma_available = False
                logger.warning("chromadb not installed — RAG/vector search disabled")
        return self._chroma_available

    @property
    def embeddings(self):
        if self._embeddings is None:
            from langchain_openai import OpenAIEmbeddings
            self._embeddings = OpenAIEmbeddings(
                model="text-embedding-3-small",
                api_key=os.getenv("OPENAI_API_KEY") or os.getenv("GROK_API_KEY") or os.getenv("GROQ_API_KEY") or "placeholder",
            )
        return self._embeddings

    @property
    def vectorstore(self):
        if self._vectorstore is None:
            if not self._is_chroma_available():
                return None
            from langchain_community.vectorstores import Chroma
            Path(PERSIST_DIR).mkdir(parents=True, exist_ok=True)
            self._vectorstore = Chroma(
                collection_name="financial_news",
                embedding_function=self.embeddings,
                persist_directory=PERSIST_DIR,
            )
        return self._vectorstore

    def add_articles(self, articles: list):
        if not self._is_chroma_available():
            return 0
        docs = []
        for article in articles:
            text = (
                f"Title: {article.get('title')}\n"
                f"Source: {article.get('source', '')}\n"
                f"Published: {article.get('published', '')}\n\n"
                f"{article.get('full_text') or article.get('summary', '')}"
            )
            splits = self.text_splitter.split_text(text)
            for i, chunk in enumerate(splits):
                doc = Document(
                    page_content=chunk,
                    metadata={
                        "title": article.get("title"),
                        "source": article.get("source"),
                        "link": article.get("link"),
                        "published": article.get("published"),
                        "chunk_id": i,
                    },
                )
                docs.append(doc)

        if docs and self.vectorstore is not None:
            self.vectorstore.add_documents(docs)
            logger.success(f"✅ Added {len(docs)} chunks to ChromaDB")
        return len(docs)

    def similarity_search(self, query: str, k: int = 6):
        if not self._is_chroma_available() or self.vectorstore is None:
            return []
        try:
            results = self.vectorstore.similarity_search(query, k=k)
            return [{"content": doc.page_content, "metadata": doc.metadata} for doc in results]
        except Exception as e:
            logger.error(f"Similarity search failed: {e}")
            return []

    def as_retriever(self):
        if not self._is_chroma_available() or self.vectorstore is None:
            return None
        return self.vectorstore.as_retriever(search_kwargs={"k": 6})
