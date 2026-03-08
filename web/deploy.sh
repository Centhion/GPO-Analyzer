#!/bin/bash
# GPO Analyzer Web - Deployment Script
# Usage: ./deploy.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=================================================="
echo "  GPO Analyzer Web - Deployment Script"
echo "=================================================="

# Check Docker is available
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose."
    exit 1
fi

# Create data directories
echo ""
echo "📁 Creating data directories..."
mkdir -p "$SCRIPT_DIR/data/uploads"
mkdir -p "$SCRIPT_DIR/../html_reports"

# Check for HTML files at project root
HTML_COUNT=$(find "$SCRIPT_DIR/../html_reports" -name "*.html" 2>/dev/null | wc -l)
if [ "$HTML_COUNT" -eq 0 ]; then
    echo ""
    echo "⚠️  No HTML files found in html_reports/"
    echo "   Copy your GPOZaurr HTML reports to the project root:"
    echo "   cp /path/to/*.html ../html_reports/"
    echo ""
fi

# Create .env if it doesn't exist
if [ ! -f "$SCRIPT_DIR/.env" ]; then
    echo "📝 Creating .env from .env.example..."
    cp "$SCRIPT_DIR/.env.example" "$SCRIPT_DIR/.env"
fi

# Use docker compose (v2) if available, otherwise docker-compose (v1)
if docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
else
    COMPOSE_CMD="docker-compose"
fi

# Build and start
echo ""
echo "🐳 Building containers..."
cd "$SCRIPT_DIR"

# Disable BuildKit attestations to prevent provenance hang
export BUILDX_NO_DEFAULT_ATTESTATIONS=1

$COMPOSE_CMD build --no-cache

echo ""
echo "🚀 Starting services..."
$COMPOSE_CMD up -d

echo ""
echo "⏳ Waiting for services to be healthy..."
sleep 5

# Health check
echo ""
echo "🔍 Checking service health..."

# Check backend
if curl -s http://localhost:9846/api/health > /dev/null 2>&1; then
    echo "   ✅ Backend API is healthy"
else
    echo "   ⏳ Backend still starting... (check logs with: docker logs gpo-analyzer-api)"
fi

# Check frontend
if curl -s http://localhost:9845/health > /dev/null 2>&1; then
    echo "   ✅ Frontend is healthy"
else
    echo "   ⏳ Frontend still starting... (check logs with: docker logs gpo-analyzer-ui)"
fi

echo ""
echo "=================================================="
echo "  ✅ Deployment Complete!"
echo "=================================================="
echo ""
echo "  Frontend: http://localhost:9845"
echo "  API:      http://localhost:9846"
echo "  API Docs: http://localhost:9846/docs"
echo ""
echo "  View logs:  docker logs -f gpo-analyzer-api"
echo "  Stop:       $COMPOSE_CMD down"
echo ""
echo "  HTML reports: $(cd "$SCRIPT_DIR/.." && pwd)/html_reports/"
echo "  ($HTML_COUNT files found)"
echo ""
