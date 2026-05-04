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
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
        )

    @property
    def embeddings(self):
        if self._embeddings is None:
            from langchain_openai import OpenAIEmbeddings
            self._embeddings = OpenAIEmbeddings(
                model="text-embedding-3-small",
                api_key=os.getenv("OPENAI_API_KEY") or os.getenv("GROK_API_KEY") or "placeholder",
            )
        return self._embeddings

    @property
    def vectorstore(self):
        if self._vectorstore is None:
            from langchain_community.vectorstores import Chroma
            Path(PERSIST_DIR).mkdir(parents=True, exist_ok=True)
            self._vectorstore = Chroma(
                collection_name="financial_news",
                embedding_function=self.embeddings,
                persist_directory=PERSIST_DIR,
            )
        return self._vectorstore

    def add_articles(self, articles: list):
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

        if docs:
            self.vectorstore.add_documents(docs)
            logger.success(f"✅ Added {len(docs)} chunks to ChromaDB")
        return len(docs)

    def similarity_search(self, query: str, k: int = 6):
        try:
            results = self.vectorstore.similarity_search(query, k=k)
            return [{"content": doc.page_content, "metadata": doc.metadata} for doc in results]
        except Exception as e:
            logger.error(f"Similarity search failed: {e}")
            return []

    def as_retriever(self):
        return self.vectorstore.as_retriever(search_kwargs={"k": 6})
