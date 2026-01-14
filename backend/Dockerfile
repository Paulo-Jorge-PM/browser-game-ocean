# Ocean Depths Backend - Multi-stage Dockerfile
# Optimized for both development and production

# ============================================
# Base stage - shared dependencies
# ============================================
FROM python:3.11-slim as base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONFAULTHANDLER=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Poetry
ENV POETRY_VERSION=1.8.5 \
    POETRY_HOME="/opt/poetry" \
    POETRY_VIRTUALENVS_CREATE=false \
    POETRY_NO_INTERACTION=1

RUN curl -sSL https://install.python-poetry.org | python3 -
ENV PATH="$POETRY_HOME/bin:$PATH"

# ============================================
# Development stage - with dev dependencies
# ============================================
FROM base as development

# Copy dependency files
COPY pyproject.toml poetry.lock* ./

# Install all dependencies including dev
RUN poetry install --no-root

# Copy application code
COPY . .

# Install the package itself
RUN poetry install --only-root

EXPOSE 8000

# Development command with hot reload
CMD ["uvicorn", "app.main:socket_app", "--reload", "--host", "0.0.0.0", "--port", "8000"]

# ============================================
# Builder stage - for production build
# ============================================
FROM base as builder

COPY pyproject.toml poetry.lock* ./

# Export production dependencies only
RUN poetry export -f requirements.txt --without-hashes --only main -o requirements.txt

# ============================================
# Production stage - minimal image
# ============================================
FROM python:3.11-slim as production

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONFAULTHANDLER=1

WORKDIR /app

# Create non-root user for security
RUN groupadd --gid 1000 appgroup && \
    useradd --uid 1000 --gid appgroup --shell /bin/bash appuser

# Copy requirements from builder
COPY --from=builder /app/requirements.txt .

# Install production dependencies only
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY --chown=appuser:appgroup . .

# Switch to non-root user
USER appuser

EXPOSE 8000

# Production command with multiple workers
CMD ["uvicorn", "app.main:socket_app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
