"""FastAPI application entry point."""

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from starlette.requests import Request
from starlette.responses import Response

from api.routers import execute, graph, ontology, protocols, routing
from api.models import HealthResponse
from protocols import __version__ as router_version

# configuration
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*").split(",")
ENV = os.getenv("ENV", "development")

app = FastAPI(
    title="Protocol Router API",
    description="Hypergraph-based protocol routing",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def disable_cache_in_dev(request: Request, call_next):
    """Disable browser caching in development (helps with Safari localhost caching)."""
    response: Response = await call_next(request)
    if ENV == "development" and (request.url.path == "/" or request.url.path.startswith("/static/")):
        # be extra explicit for Safari
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response

# include API routers
app.include_router(graph.router, prefix="/api/graph", tags=["graph"])
app.include_router(protocols.router, prefix="/api/protocols", tags=["protocols"])
app.include_router(routing.router, prefix="/api/routing", tags=["routing"])
app.include_router(execute.router, prefix="/api/verify", tags=["verify"])
app.include_router(ontology.router, prefix="/api/ontology", tags=["ontology"])


@app.get("/api/health", response_model=HealthResponse, tags=["health"])
def health_check():
    """Health check endpoint."""
    return HealthResponse(status="healthy", version=router_version)


# serve dashboard static files (must be last)
dashboard_path = "dashboard"
if os.path.exists(dashboard_path):
    app.mount("/static", StaticFiles(directory=dashboard_path), name="static")
    
    @app.get("/")
    async def serve_dashboard():
        """Serve the dashboard UI index.html."""
        return FileResponse(f"{dashboard_path}/index.html")
