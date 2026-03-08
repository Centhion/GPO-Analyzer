#!/bin/bash
# GPO Analyzer - Build and Push Script
#
# Builds container images and optionally pushes to registry.
#
# USAGE:
#   ./build.sh              # Build only (local)
#   ./build.sh --push       # Build and push to registry
#   ./build.sh --tag v2.3.2 # Build with specific tag
#
# ENVIRONMENT VARIABLES:
#   REGISTRY  - Container registry (default: localhost)
#   TAG       - Image tag (default: latest)

set -e

# Defaults
REGISTRY="${REGISTRY:-localhost}"
TAG="${TAG:-latest}"
PUSH=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --push)
            PUSH=true
            shift
            ;;
        --tag)
            TAG="$2"
            shift 2
            ;;
        --registry)
            REGISTRY="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--push] [--tag TAG] [--registry REGISTRY]"
            exit 1
            ;;
    esac
done

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "========================================"
echo "GPO Analyzer - Container Build"
echo "========================================"
echo "Project Root: $PROJECT_ROOT"
echo "Registry:     $REGISTRY"
echo "Tag:          $TAG"
echo "Push:         $PUSH"
echo "========================================"

# Change to project root for build context
cd "$PROJECT_ROOT"

# Build backend
echo ""
echo "Building backend image..."
docker build \
    -f web/backend/Dockerfile \
    -t "${REGISTRY}/gpo-analyzer-backend:${TAG}" \
    .

# Build frontend
echo ""
echo "Building frontend image..."
docker build \
    -f web/frontend/Dockerfile \
    -t "${REGISTRY}/gpo-analyzer-frontend:${TAG}" \
    web/frontend

echo ""
echo "✓ Build complete!"
echo "  Backend:  ${REGISTRY}/gpo-analyzer-backend:${TAG}"
echo "  Frontend: ${REGISTRY}/gpo-analyzer-frontend:${TAG}"

# Push if requested
if [ "$PUSH" = true ]; then
    echo ""
    echo "Pushing to registry..."
    docker push "${REGISTRY}/gpo-analyzer-backend:${TAG}"
    docker push "${REGISTRY}/gpo-analyzer-frontend:${TAG}"
    echo ""
    echo "✓ Push complete!"
fi

echo ""
echo "To run locally:"
echo "  cd web && docker compose up -d"
echo ""
echo "To deploy from registry:"
echo "  REGISTRY=$REGISTRY TAG=$TAG docker compose -f docker-compose.prod.yml up -d"
