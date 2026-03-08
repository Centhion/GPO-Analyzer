# GPO Analyzer Web Interface

**Version:** 3.3.0
**Backbone:** v2.3.3

React/FastAPI web application providing a browser-based interface for GPO analysis.

See the main [README.md](../README.md) for complete project documentation.

---

## Quick Start

```bash
# Build and run
docker compose build --no-cache
docker compose up -d

# Access at http://localhost:9845

# Stop
docker compose down

# View logs
docker compose logs -f
```

---

## Architecture

```
web/
├── docker-compose.yml      # Container orchestration
├── docker-compose.prod.yml # Production deployment
├── build.sh                # Build helper script
├── backend/
│   ├── Dockerfile          # Copies backbone from project root during build
│   ├── requirements.txt
│   └── app/
│       ├── main.py              # FastAPI entry point
│       ├── routers/
│       │   ├── executive.py     # Executive mode endpoints
│       │   ├── domain.py        # Optimization mode endpoints
│       │   ├── migration.py     # Migration mode endpoints
│       │   ├── commands.py      # CLI reports (Impact, Full)
│       │   ├── upload.py        # File upload & export
│       │   └── downloads.py     # CLI file downloads with TTL
│       └── services/
│           └── analyzer.py      # Thin wrapper around backbone
└── frontend/
    ├── Dockerfile
    ├── package.json
    └── src/
        ├── App.tsx
        └── pages/
            ├── ExecutiveDashboard.tsx    # Executive mode
            ├── OptimizationDashboard.tsx # Optimization mode  
            ├── MigrationDashboard.tsx    # Migration mode
            ├── CLIReportsPage.tsx        # CLI-only reports
            └── UploadPage.tsx            # File upload
```

**Note:** The backbone (`gpo_analyzer_v2_3_2.py`) is copied INTO the container image during build, not mounted at runtime. This ensures portable, CI/CD-ready deployments.

---

## Modes

| Mode | Purpose | Access |
|------|---------|--------|
| **Executive** | Cross-domain GPO health dashboard | Web + CLI |
| **Optimization** | Operation-specific GPO analysis and bucket optimization | Web + CLI |
| **Migration** | Setting-level comparison against baseline.corp baseline | Web + CLI |
| **Impact** | GPO replacement impact analysis | CLI only |
| **Full** | Complete 19-tab report | CLI only |

---

## Updating

When updating the backbone:

```bash
# 1. Edit gpo_analyzer_v2_3_2.py in project root

# 2. Rebuild (backbone is baked into image)
cd web
docker compose down
docker compose build --no-cache
docker compose up -d
```

**Note:** The backbone is copied into the container at build time from the project root. Changes to the backbone require a rebuild.

---

## Ports

| Service | Port | Purpose |
|---------|------|---------|
| Frontend | 9845 | React UI (nginx) |
| Backend | 9846 | FastAPI (internal) |

---

## Development

### Frontend only
```bash
cd frontend
npm install
npm run dev
```

### Backend only
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 9846
```

---

## Migration Mode

The Migration Dashboard compares operation domain settings against baseline.corp baseline.

### Tabs

| Tab | Description |
|-----|-------------|
| **Migration Summary** | Classification counts and GPO priority overview |
| **GPO Summary** | Per-GPO breakdown with P1-P4 priority and action items |
| **Settings Analysis** | Detailed view (available in Excel export) |
| **Review Required** | Conflicts needing manual review (available in Excel export) |

### Classifications

| Classification | Meaning |
|----------------|---------|
| MIGRATE | Setting unique to operation - must be recreated in new domain |
| DON'T MIGRATE | Setting already exists in enterprise baseline with matching value |
| REVIEW | Setting exists in both but values differ - manual decision required |

### GPO Actions (v3.3.0)

| Action | Priority | Description |
|--------|----------|-------------|
| MIGRATE GPO | P1 | All settings unique - ready to migrate |
| MIGRATE + REVIEW conflicts | P2 | Has unique settings AND conflicts to resolve |
| MIGRATE (partial overlap) | P2 | Some settings overlap but still needs migration |
| REVIEW conflicts only | P3 | No unique settings, only conflicts to review |
| SKIP (enterprise covers) | P4 | All settings already exist in enterprise baseline |
| SKIP (enterprise managed) | P4 | Enterprise Standard GPO - enterprise-managed, no local action |
| SKIP (enterprise managed - DRIFT DETECTED) | P3 | Enterprise Standard GPO differs from baseline - flag for review |
| NO SETTINGS (links only) | P4 | GPO has no extractable settings |

### Enterprise Standard GPO Handling (New in v3.3.0)

Enterprise Standard GPOs in standalone domains are now clearly identified:

- **No Drift**: Shows "SKIP (enterprise managed)" - GPO matches enterprise baseline
- **Drift Detected**: Shows "SKIP (enterprise managed - DRIFT DETECTED)" - local copy differs from baseline

This prevents confusion where Enterprise Standard GPOs previously showed "MIGRATE" when they should actually be enterprise-managed policies.

### Zero-Settings GPOs (New in v3.3.0)

Migration Mode now includes ALL Active GPOs, even those without extractable settings:
- Shows "NO SETTINGS (links only)" for GPOs with no parsed settings
- Ensures complete visibility of migration scope

---

## Impact Mode (CLI Only)

GPO replacement impact analysis - shows what happens when you replace operation GPOs with enterprise standard equivalents.

**Purpose:** Answers "What happens when I flip the switch?"

**When to use:** After migration planning, before execution - validates the impact of GPO replacement.

### CLI Usage

```bash
python gpo_analyzer.py --mode impact --domain corp.alpha.com --html-folder data/html_reports --output data/downloads/alpha_impact.xlsx
```

### Output Tabs

| Tab | Description | Priority |
|-----|-------------|----------|
| **Impact_Summary** | Per-GPO risk assessment with explanation | Overview |
| **Settings_Retained** | Settings that stay the same | No action needed |
| **Settings_Lost** | Settings that will be lost if not migrated elsewhere | **CRITICAL** |
| **Settings_Changed** | Settings with different values - review before switch | **CRITICAL** |
| **Settings_Added** | New settings from enterprise standards that will apply after migration | Awareness |

### Risk Assessment Logic

| Level | Criteria | Meaning |
|-------|----------|---------|
| **HIGH** | Lost > 5 OR Changed > 3 | Significant changes - careful review required |
| **MEDIUM** | Lost > 0 OR Changed > 0 | Some settings require action before replacement |
| **LOW** | Lost = 0 AND Changed = 0 | Safe replacement - only gains new settings |

---

## CLI Downloads

Reports generated via CLI can be downloaded directly via clickable URL.

### How It Works

1. Save output to `data/downloads/`:
   ```bash
   python gpo_analyzer.py --mode executive --output data/downloads/executive.xlsx
   ```

2. CLI prints download URL:
   ```
   Report saved to: /app/data/downloads/executive.xlsx
   ✓ Download: http://localhost:9845/api/downloads/executive.xlsx
   ```

3. Click the URL to download the file directly to your browser.

### Auto-Cleanup

- Files in `data/downloads/` are automatically deleted after **60 minutes**
- Cleanup runs every 30 minutes
- No manual cleanup required

### Folder Structure

| Folder | Purpose |
|--------|---------|
| `/app/data/html_reports/` | INPUT: GPOZaurr HTML files |
| `/app/data/downloads/` | OUTPUT: CLI reports (auto-cleanup) |

---

## Troubleshooting

### Container won't start
```bash
docker compose logs backend
docker compose logs frontend
```

### Data not updating
```bash
# Full rebuild
docker compose down
docker compose build --no-cache
docker compose up -d
```

### CORS errors
Check `main.py` CORS configuration matches your environment.
