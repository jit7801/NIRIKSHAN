import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from app.core.config import settings
from app.api.v1.router import router as api_router, load_and_run_pipeline

# Configure application logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("mplads.main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting {settings.PROJECT_NAME} v{settings.VERSION}...")
    load_and_run_pipeline()
    logger.info("[*] Analytical engines initialized and cached in memory. Service ready.")
    yield
    logger.info("[*] Shutting down service cleanly.")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Explainable Risk Intelligence Layer for MPLADS Scheme",
    lifespan=lifespan
)

# Enable GZip compression for large API responses (improves 60k record payload delivery)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# CORS configuration with configurable whitelist
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS if settings.CORS_ORIGINS else ["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# Mount API V1 and alias for direct /api access
app.include_router(api_router, prefix=settings.API_V1_STR)
app.include_router(api_router, prefix="/api")

@app.get("/")
def root():
    return {
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "docs_url": "/docs",
        "api_v1": settings.API_V1_STR,
        "data_provenance": settings.DATA_SOURCE_LABEL,
        "is_demo_mode": settings.IS_DEMO_MODE,
        "evaluation_date": settings.EVALUATION_DATE
    }

@app.get("/health")
def root_health():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "data_provenance": settings.DATA_SOURCE_LABEL,
        "is_demo_mode": settings.IS_DEMO_MODE,
        "evaluation_date": settings.EVALUATION_DATE
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
