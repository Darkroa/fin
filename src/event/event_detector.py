from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import PydanticOutputParser
from loguru import logger
import json
import os
from pathlib import Path
from sqlalchemy.orm import Session
from src.database.models import Event
from prometheus_client import Counter, Histogram

EVENTS_DETECTED = Counter(
    "finevent_events_detected_total",
    "Total number of financial events detected",
    ["event_type", "sentiment"],
)

HIGH_IMPACT_EVENTS = Counter(
    "finevent_high_impact_events_total",
    "Number of high-impact events (score >= 7)",
    ["event_type"],
)

EVENT_PROCESSING_TIME = Histogram(
    "finevent_event_processing_seconds",
    "Time spent processing and forecasting each event",
    buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0],
)


class FinancialEvent(BaseModel):
    event_type: str = Field(..., description="earnings, merger_acquisition, fed_policy, geopolitical, etc.")
    title: str
    description: str
    tickers_affected: List[str] = Field(default_factory=list)
    impact_score: int = Field(..., ge=1, le=10)
    sentiment: str = Field(..., description="positive, negative, neutral")
    confidence: float = Field(..., ge=0, le=1)
    published_date: Optional[str] = None
    source_url: Optional[str] = None
    short_term_impact: str = Field(..., description="Expected market reaction in next 24-48 hours")
    medium_term_impact: str = Field(..., description="Impact over next 1-4 weeks")
    risk_level: str = Field(..., description="low, medium, high")


class EventDetector:
    def __init__(self):
        self._llm = None
        self.parser = PydanticOutputParser(pydantic_object=FinancialEvent)
        self.prompt = ChatPromptTemplate.from_template("""
        You are a senior financial analyst specializing in event impact forecasting.

        {format_instructions}

        Article:
        Title: {title}
        Summary: {summary}
        Full Text: {full_text}

        Extract the main event(s) and provide realistic forecasts.
        Return ONLY valid JSON. No extra text.
        """)

    @property
    def llm(self):
        if self._llm is None:
            from langchain_openai import ChatOpenAI
            self._llm = ChatOpenAI(
                model="gpt-4o-mini",
                temperature=0.0,
                api_key=os.getenv("OPENAI_API_KEY") or os.getenv("GROK_API_KEY") or "placeholder",
            )
        return self._llm

    def detect_events(self, article: dict) -> List[FinancialEvent]:
        start_time = datetime.now()
        try:
            chain = self.prompt | self.llm | self.parser
            result = chain.invoke({
                "title": article.get("title", ""),
                "summary": article.get("summary", ""),
                "full_text": article.get("full_text", "")[:10000],
                "format_instructions": self.parser.get_format_instructions(),
            })

            events = [result] if not isinstance(result, list) else result

            for event in events:
                EVENTS_DETECTED.labels(
                    event_type=event.event_type,
                    sentiment=event.sentiment,
                ).inc()
                if event.impact_score >= 7:
                    HIGH_IMPACT_EVENTS.labels(event_type=event.event_type).inc()

            processing_time = (datetime.now() - start_time).total_seconds()
            EVENT_PROCESSING_TIME.observe(processing_time)
            logger.info(f"Detected {len(events)} events from '{article.get('title', '')[:60]}'")
            return events
        except Exception as e:
            logger.error(f"Event detection failed: {e}")
            return []

    def save_events_to_db(self, events: List[FinancialEvent], db: Session):
        saved_count = 0
        for event in events:
            db_event = Event(
                event_type=event.event_type,
                title=event.title,
                description=event.description,
                tickers_affected=event.tickers_affected,
                impact_score=event.impact_score,
                sentiment=event.sentiment,
                confidence=event.confidence,
                short_term_impact=event.short_term_impact,
                medium_term_impact=event.medium_term_impact,
                risk_level=event.risk_level,
                published_date=datetime.fromisoformat(event.published_date) if event.published_date else datetime.utcnow(),
                source_url=event.source_url,
            )
            db.add(db_event)
            saved_count += 1
        db.commit()
        logger.success(f"💾 Saved {saved_count} events to PostgreSQL database")
        return saved_count

    def save_events_to_json(self, events: List[FinancialEvent]):
        path = Path("data/processed_events") / f"events_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump([e.model_dump() for e in events], f, indent=2, default=str)
        logger.success(f"💾 Saved {len(events)} events to JSON")
