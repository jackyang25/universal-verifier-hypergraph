"""FastAPI application entry point."""

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from api.routers import graph, packs, routing
from api.models import HealthResponse
from axiom_router import __version__ as router_version

# configuration
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*").split(",")
ENV = os.getenv("ENV", "development")

app = FastAPI(
    title="Axiom Pack Router API",
    description="Hypergraph-based medical decision support routing",
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

# include API routers
app.include_router(graph.router, prefix="/api/graph", tags=["graph"])
app.include_router(packs.router, prefix="/api/packs", tags=["axiom-packs"])
app.include_router(routing.router, prefix="/api/routing", tags=["routing"])


@app.get("/api/health", response_model=HealthResponse, tags=["health"])
def health_check():
    """Health check endpoint."""
    return HealthResponse(status="healthy", version=router_version)


# serve playground static files (must be last)
playground_path = "playground"
if os.path.exists(playground_path):
    app.mount("/static", StaticFiles(directory=playground_path), name="static")
    
    @app.get("/")
    async def serve_playground():
        """Serve the playground UI index.html."""
        return FileResponse(f"{playground_path}/index.html")
