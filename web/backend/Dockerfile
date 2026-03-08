# GPO Analyzer Backend Dockerfile
# Multi-stage build for smaller final image
#
# BUILD CONTEXT: Project root (GPO_Analyzer_Dev/)
# BUILD COMMAND: docker compose build (from web/ directory)
#
# The gpo_analyzer script is now COPIED into the image (not mounted)
# This enables true container portability and CI/CD registry deployments

# Stage 1: Build dependencies
FROM python:3.11-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
# Note: paths relative to project root (build context)
COPY web/backend/requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt


# Stage 2: Runtime
FROM python:3.11-slim

WORKDIR /app

# Copy Python packages from builder
COPY --from=builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH

# Copy application code
# Note: paths relative to project root (build context)
COPY web/backend/app/ ./app/

# Copy backbone analyzer (single source of truth)
COPY gpo_analyzer_v2_3_2.py ./gpo_analyzer.py

# Create data directories
RUN mkdir -p /app/data/html_reports /app/data/uploads

# Set environment variables
ENV GPO_HTML_FOLDER=/app/data/html_reports
ENV GPO_UPLOAD_FOLDER=/app/data/uploads
ENV PYTHONUNBUFFERED=1

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')" || exit 1

# Run with uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
