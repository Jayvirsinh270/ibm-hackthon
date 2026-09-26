import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import settings
from backend.database import init_db

logging.basicConfig(level=getattr(logging, settings.LOG_LEVEL, logging.INFO))
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("X-Ray backend starting up")
    init_db()
    logger.info("Database initialised")
    yield
    logger.info("X-Ray backend shutting down")


app = FastAPI(
    title="X-Ray API",
    description="Intelligent Software Change Impact Analyzer",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
from backend.api.upload import router as upload_router
from backend.api.scan import router as scan_router
from backend.api.graph import router as graph_router      # stub — Phase 4
from backend.api.impact import router as impact_router    # stub — Phase 6
from backend.api.explain import router as explain_router  # stub — Phase 8
from backend.api.source import router as source_router

app.include_router(upload_router, prefix="/api")
app.include_router(scan_router,   prefix="/api")
app.include_router(graph_router,  prefix="/api")
app.include_router(impact_router, prefix="/api")
app.include_router(explain_router, prefix="/api")
app.include_router(source_router, prefix="/api")


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/api/health", tags=["health"])
async def health():
    """Returns service status. Used by the frontend to verify connectivity."""
    return {"status": "ok", "service": "xray"}
