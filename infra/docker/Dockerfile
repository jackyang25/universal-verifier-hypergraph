FROM python:3.11-slim

WORKDIR /app

# Install Python dependencies
COPY backend/pyproject.toml /app/backend/pyproject.toml
COPY backend/src /app/backend/src
RUN pip install --no-cache-dir /app/backend

# Keep source mounted at runtime for local development
COPY backend/src ./src

EXPOSE 8000

# Run FastAPI with uvicorn
CMD ["uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
