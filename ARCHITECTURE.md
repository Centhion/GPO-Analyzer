# GPO Analyzer - Architecture

**Version:** 2.3.3 (Backbone) / 3.3.0 (Web)
**Last Updated:** January 22, 2026

---

## Overview

GPO Analyzer is a two-component system for Active Directory GPO analysis:

```
┌─────────────────────────────────────────────────────────────┐
│                     GPO ANALYZER                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────┐      ┌─────────────────────────┐  │
│  │      BACKBONE       │      │     WEB INTERFACE       │  │
│  │  gpo_analyzer.py    │◄────►│   React + FastAPI       │  │
│  │  (~6,700 lines)     │      │   (web/)                │  │
│  │                     │      │                         │  │
│  │  • All business     │      │  • Display only         │  │
│  │    logic            │      │  • Calls backbone       │  │
│  │  • Excel generation │      │  • No business logic    │  │
│  │  • CLI interface    │      │                         │  │
│  └─────────────────────┘      └─────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Core Principle:** All logic lives in the backbone. Web is a thin display layer.

---

## Component Architecture

### Backbone (`gpo_analyzer_v2_3_2.py`)

Single-file Python module containing:

| Component | Purpose |
|-----------|---------|
| `LOCATION_MAPPING` | Operation configuration (10+ operations) |
| `GPOAnalyzer` class | Main analysis engine |
| `SettingExtractionEngine` | GPO setting parser |
| CLI interface | argparse entry point |
| Excel generators | Mode-specific report builders |

**Key Methods:**

```python
class GPOAnalyzer:
    def parse_html_reports()      # Stage 1: Load GPOZaurr HTML
    def filter_active_gpos()      # Stage 2: Keep Enabled+Linked only
    def categorize_gpos()         # Stage 3: Bucket classification
    def analyze_settings()        # Stage 4: Setting extraction
    def generate_excel_report()   # Stage 5: Output generation
    
    # Web API methods (JSON output)
    def get_executive_summary()
    def get_domain_overview()
    def get_migration_summary()
```

### Web Interface (`web/`)

```
web/
├── backend/                    # FastAPI (Python)
│   ├── app/
│   │   ├── main.py            # Entry point, CORS, lifespan
│   │   ├── config.py          # Settings (ports, paths, TTL)
│   │   ├── routers/
│   │   │   ├── executive.py   # GET /api/executive/*
│   │   │   ├── domain.py      # GET /api/domain/*
│   │   │   ├── migration.py   # GET /api/migration/*
│   │   │   ├── commands.py    # POST /api/commands/* (CLI reports)
│   │   │   ├── upload.py      # POST /api/upload, exports
│   │   │   └── downloads.py   # GET /api/downloads/* (CLI files)
│   │   └── services/
│   │       └── analyzer.py    # Thin wrapper → backbone
│   └── Dockerfile
│
└── frontend/                   # React + TypeScript
    ├── src/
    │   ├── App.tsx            # Router, nav
    │   ├── pages/
    │   │   ├── ExecutiveDashboard.tsx
    │   │   ├── OptimizationDashboard.tsx
    │   │   ├── MigrationDashboard.tsx
    │   │   ├── CLIReportsPage.tsx
    │   │   └── UploadPage.tsx
    │   └── services/
    │       └── api.ts         # Axios HTTP client
    └── Dockerfile
```

**Ports:**
- Frontend (nginx): 9845
- Backend (uvicorn): 9846 (internal)

---

## Modes

| Mode | Purpose | Tabs | Access |
|------|---------|------|--------|
| **Executive** | Cross-domain health dashboard | 7 | Web + CLI |
| **Domain** | Single operation bucket analysis | 5 | Web + CLI |
| **Migration** | Setting comparison vs baseline.corp | 4 | Web + CLI |
| **Impact** | GPO replacement risk analysis | 5 | CLI only |
| **Full** | Complete raw data dump | 19 | CLI only |

### Mode Data Flow

```
                    ┌─────────────┐
                    │  GPOZaurr   │
                    │  HTML Files │
                    └──────┬──────┘
                           │
                           ▼
              ┌────────────────────────┐
              │   parse_html_reports() │
              │   Extract tables       │
              └───────────┬────────────┘
                          │
                          ▼
              ┌────────────────────────┐
              │   filter_active_gpos() │
              │   Enabled + Linked     │
              └───────────┬────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
    ┌──────────┐    ┌──────────┐    ┌──────────┐
    │Executive │    │ Domain   │    │Migration │
    │  Mode    │    │  Mode    │    │  Mode    │
    └────┬─────┘    └────┬─────┘    └────┬─────┘
         │               │               │
         ▼               ▼               ▼
    ┌──────────┐    ┌──────────┐    ┌──────────┐
    │ 7-tab    │    │ 5-tab    │    │ 4-tab    │
    │ Excel    │    │ Excel    │    │ Excel    │
    └──────────┘    └──────────┘    └──────────┘
```

---

## Key Algorithms

### Bucket Classification

GPOs are classified by their OU link targets:

```
GPO Link Target OU
        │
        ├─► Contains "Server"/"Servers" ──────► Server bucket
        │
        ├─► Contains "Workstation"/"Computer" ► Workstation bucket
        │
        ├─► Contains "User"/"People" ─────────► User bucket
        │
        ├─► Contains "Domain Controller" ─────► DC bucket
        │
        ├─► Is Domain Root ───────────────────► Domain Root bucket
        │
        ├─► Multiple bucket types ────────────► Mixed bucket
        │
        └─► None match ───────────────────────► Unknown bucket
```

### Operation Detection

GPOs are matched to operations via:

1. **Name Match** - GPO name contains operation prefix (e.g., "OPA - Firewall")
2. **Links-Only** - GPO linked to operation's OU but name doesn't match

```python
LOCATION_MAPPING = {
    'OPA': {
        'full_name': 'Alpha',
        'source_domain': 'corp.alpha.com',
        'name_prefixes': ['OPA', 'Alpha'],  # Name match patterns
    }
}
```

### Migration Classification

Settings are compared against baseline.corp baseline:

| Condition | Classification |
|-----------|----------------|
| Setting only in operation domain | MIGRATE |
| Setting in both, same value | DON'T MIGRATE |
| Setting in both, different value | REVIEW |

### Enterprise Standard GPO Detection (v2.3.3)

Enterprise Standard GPOs are identified via naming patterns:
- Starts with "ENT -" or "ENT-"
- Matches known Enterprise Standard GPO names (DefaultDomain, Hybrid Azure, etc.)

```
is_enterprise_standard_gpo(gpo_name)
        │
        ├─► Name starts with "ENT" ─────────► True
        │
        ├─► Matches ENT prefix pattern ─────► True
        │
        └─► Otherwise ──────────────────────► False
```

Enterprise Standard GPOs in standalone domains show:
- **SKIP (enterprise managed)** - matches baseline
- **SKIP (enterprise managed - DRIFT DETECTED)** - differs from baseline (flagged for review)

### Zero-Settings GPO Inclusion (v2.3.3)

Migration Mode now includes ALL Active GPOs, even those without extractable settings:
- GPOs with settings: Show MIGRATE/DON'T MIGRATE/REVIEW based on comparison
- GPOs without settings: Show "NO SETTINGS (links only)" - still counted in migration scope

---

## Data Structures

### Core DataFrame: `active_gpos`

| Column | Description |
|--------|-------------|
| GPO Name | Policy name |
| Domain | Source AD domain |
| Enabled | True/False |
| Linked | True/False |
| Links | Semicolon-separated OU paths |
| Bucket | Server/Workstation/User/Mixed/Unknown |
| DetectedOperation | Matched operation code |
| MatchType | "Name Match" or "Links Only" |

### Settings Storage

```python
self.all_settings = [
    {
        'Domain': 'corp.alpha.com',
        'GPO_Name': 'OPA - Firewall',
        'Category': 'SecurityOptions',
        'Setting_Name': 'Network access: ...',
        'Setting_Value': 'Enabled',
        'Setting_Details': '...'
    },
    ...
]
```

---

## Extension Points

### Adding a New Operation

1. Add to `LOCATION_MAPPING` in backbone:
```python
'OPX': {
    'full_name': 'X-Ray',
    'source_domain': 'corp.xray.com',
    'name_prefixes': ['OPX', 'X-Ray'],
}
```

2. Place GPOZaurr HTML report in `html_reports/`

3. Run analysis

### Adding a New Mode

1. Create generator method in `GPOAnalyzer`:
```python
def _generate_newmode_report(self, writer):
    # Create tabs with self._write_tab()
```

2. Add to mode dispatcher in `generate_excel_report()`

3. Add CLI argument in `main()`

4. (Optional) Add web endpoint and UI page

---

## File Locations

| Path | Purpose |
|------|---------|
| `gpo_analyzer_v2_3_2.py` | Backbone (project root) |
| `web/` | Web interface |
| `web/data/html_reports/` | GPOZaurr input files |
| `web/data/downloads/` | CLI output files (auto-cleanup) |

---

## Related Documentation

| Document | Purpose |
|----------|---------|
| `README.md` | User guide and quick start |
| `SETUP_GUIDE.md` | Complete setup and deployment instructions |
| `ARCHITECTURE.md` | System architecture (this file) |
| `LOCATION_CODES.md` | Operation code quick reference |
| `web/README.md` | Web interface documentation |
