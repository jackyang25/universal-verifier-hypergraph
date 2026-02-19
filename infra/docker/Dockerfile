FROM ubuntu:22.04 AS cohere-builder

ARG COHERE_REPO_URL="https://github.com/jackyang25/cohere.git"
ARG COHERE_REF="main"

WORKDIR /cohere

ARG DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    build-essential \
    xz-utils \
    zstd \
  && rm -rf /var/lib/apt/lists/*

RUN curl -sSf https://raw.githubusercontent.com/leanprover/elan/master/elan-init.sh | sh -s -- -y
ENV PATH="/root/.elan/bin:${PATH}"
RUN elan toolchain install leanprover/lean4:v4.15.0
RUN elan default leanprover/lean4:v4.15.0

RUN git clone --depth 1 --branch "${COHERE_REF}" "${COHERE_REPO_URL}" /cohere/src
WORKDIR /cohere/src
RUN lake build cohere-verify


FROM python:3.11-slim

WORKDIR /app

COPY --from=cohere-builder /cohere/src/.lake/build/bin/cohere-verify /usr/local/bin/cohere-verify

COPY backend/pyproject.toml /app/backend/pyproject.toml
COPY backend/src /app/backend/src
RUN pip install --no-cache-dir /app/backend

COPY backend/src ./src

EXPOSE 8000

CMD ["uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
