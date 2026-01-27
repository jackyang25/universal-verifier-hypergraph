FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for LEAN 4
RUN apt-get update && apt-get install -y \
    curl \
    git \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install LEAN 4 using elan (LEAN version manager)
RUN curl https://raw.githubusercontent.com/leanprover/elan/master/elan-init.sh -sSf | sh -s -- -y --default-toolchain leanprover/lean4:stable
ENV PATH="/root/.elan/bin:${PATH}"

# Verify LEAN installation
RUN lean --version

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY protocols/ protocols/
COPY ontology/ ontology/
COPY verification/ verification/
COPY api/ api/
COPY dashboard/ dashboard/

EXPOSE 8000

# Run FastAPI with uvicorn
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
