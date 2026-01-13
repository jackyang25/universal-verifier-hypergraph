FROM python:3.11-slim

WORKDIR /app

# install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# copy application
COPY axiom_router/ axiom_router/
COPY api/ api/
COPY config/ config/
COPY playground/ playground/

EXPOSE 8000

# run FastAPI with uvicorn
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
