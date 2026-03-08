# GPO Analyzer - Docker Build Script (Windows PowerShell)
# Disables Docker BuildKit attestations to prevent provenance hang

$env:BUILDX_NO_DEFAULT_ATTESTATIONS = "1"

Write-Host "Building GPO Analyzer containers..." -ForegroundColor Cyan
docker compose build --no-cache

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Build successful!" -ForegroundColor Green
    Write-Host "Run 'docker compose up -d' to start containers" -ForegroundColor Yellow
} else {
    Write-Host ""
    Write-Host "Build failed!" -ForegroundColor Red
}
