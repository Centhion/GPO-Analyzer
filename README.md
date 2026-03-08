# GPO Analyzer

**Version:** 2.3.3 | **Author:** Eric Tamez

> Production-tested GPO analysis and migration planning tool for Active Directory. Works with a single domain or across an entire multi-forest enterprise. Built for a real environment, templated for reuse at any organization. See [`SETUP_GUIDE.md`](SETUP_GUIDE.md) to get started.

---

## Overview

GPO Analyzer processes [GPOZaurr](https://github.com/EvotecIT/GPOZaurr) HTML reports and delivers insights through two interfaces:

- **Python CLI** — Generates multi-tab Excel reports for offline analysis and stakeholder distribution
- **Web Dashboard** — Full-stack React + FastAPI application with interactive dashboards, drill-down GPO details, file upload, Entra ID authentication, and Docker deployment

Both interfaces share a single Python backbone (~6,700 lines) as the source of truth. The web layer is display-only — zero business logic duplication.

Works at any scale — from a single AD domain to a multi-forest enterprise with dozens of operations.

---

## Reports

### Executive Report (7-tab Excel)
Enterprise-wide GPO health dashboard across all domains. Surfaces readiness metrics, cross-domain settings overlap, performance issues (empty GPOs, WMI filter problems), infrastructure dependencies, and a consolidation roadmap.

### Domain / Optimization Report (5-tab Excel)
Deep dive into a single operation's GPO structure. Classifies every GPO into **Server**, **Workstation**, **User**, **Domain Controller**, or **Domain Root** buckets based on OU link targets. Flags mixed-target and unclassifiable GPOs for review.

### Migration Report (4-tab Excel)
Setting-level comparison of an operation's GPOs against the enterprise baseline. Every setting is classified as **MIGRATE** (unique to operation), **DON'T MIGRATE** (already covered by baseline), or **REVIEW** (exists in both with different values). GPOs are prioritized P1-P4 with specific actions.

### Impact Report (5-tab Excel)
Risk analysis for GPO replacement — answers "what happens when I flip the switch?" Shows settings retained, lost, changed, and added, with per-GPO risk scoring (HIGH / MEDIUM / LOW).

### Full Report (19-tab Excel)
Complete raw data dump with all parsed GPO data, settings, links, and metadata across every domain. Designed for data analysts who need to slice the data their own way.

---

## When to Use Each Report

| Scenario | Report | Example |
|----------|--------|---------|
| "How healthy are our GPOs across the org?" | Executive | CTO wants a dashboard |
| "What GPOs does the Denver office have?" | Domain | Preparing for a single-site audit |
| "Which settings do we need to migrate?" | Migration | Planning domain consolidation |
| "What breaks if we switch to enterprise GPOs?" | Impact | Pre-migration risk check |
| "Give me everything — I'll analyze it myself" | Full | Data team building custom reports |

**Single domain?** Use Domain mode. No shared forest or migration baseline needed.

**Multi-domain consolidation?** Start with Executive for the big picture, then Migration + Impact per domain.

---

## Concepts

### Operations

An **operation** is a logical business unit (site, region, division) with its own GPO policies. Each operation maps to one or more AD domains. If you only have one domain, you have one operation.

### Shared Forest vs. Standalone Domains

- **Standalone** — An operation has its own AD domain (e.g., `corp.alpha.com`). All GPOs in that domain belong to that operation. **This is the simplest setup — one domain, one HTML report, done.**
- **Shared Forest** — Multiple operations share a single AD forest (e.g., `baseline.corp`). GPOs are distinguished by naming prefix (e.g., `OPF - Firewall`, `OPG - Printers`).
- **Hybrid** — A standalone operation that also has GPOs in the shared forest. Both sets apply.

### Enterprise Standard GPOs

GPOs prefixed with `ENT` (e.g., `ENT - Security Baseline`) represent enterprise-wide standards managed centrally. During migration analysis, these are compared against the shared forest baseline to detect drift. If your org doesn't use enterprise standard GPOs, this feature is safely ignored.

### Buckets

GPOs are classified by their OU link targets into buckets: **Server**, **Workstation**, **User**, **Domain Controller**, **Domain Root**, **Mixed**, or **Unknown**.

---

## Quick Start

### Prerequisites

- Python 3.11+
- GPOZaurr HTML reports in a folder
- Required packages: `pandas`, `openpyxl`, `beautifulsoup4`, `lxml`

### Installation

```bash
pip install pandas openpyxl beautifulsoup4 lxml
```

### CLI Usage

```bash
# Executive Mode - all operations summary
python gpo_analyzer_v2_3_2.py --mode executive --html-folder ./reports

# Domain Mode - single operation deep dive
python gpo_analyzer_v2_3_2.py --mode domain --operation OPF --html-folder ./reports

# Migration Mode - setting-level comparison
python gpo_analyzer_v2_3_2.py --mode migration --domain corp.alpha.com --html-folder ./reports

# Impact Mode - replacement risk analysis
python gpo_analyzer_v2_3_2.py --mode impact --domain corp.alpha.com --html-folder ./reports

# Full Mode - complete data dump
python gpo_analyzer_v2_3_2.py --mode full --html-folder ./reports
```

### Web Interface (v3.3.0)

Interactive browser-based dashboard built with React, TypeScript, Tailwind CSS, and FastAPI.

**Features:**
- Executive, Domain, and Migration dashboards with real-time data
- Click-through GPO details with setting-level drill-down
- HTML report upload via drag-and-drop
- Excel export from any dashboard
- Entra ID (Azure AD) authentication (optional)
- Dockerized deployment (frontend on nginx, backend on uvicorn)

```bash
cd web
docker compose build --no-cache
docker compose up -d

# Access at http://localhost:9845
```

See [`web/README.md`](web/README.md) for full web interface documentation.

---

## Example Configuration

The included `LOCATION_MAPPING` ships with 10 sample operations using NATO phonetic names. Replace these with your own.

### Shared Forest Operations (5)

Operations with GPOs in `baseline.corp`:

| Code | Name | Notes |
|------|------|-------|
| OPF | Operation Foxtrot | Region West |
| OPG | Operation Golf | Region West |
| OPH | Operation Hotel | Region East |
| OPI | Operation India | Corporate / HQ |
| OPJ | Operation Juliet | Region East |

### Standalone Operations (5)

Operations with their own AD domain:

| Code | Domain | Hybrid |
|------|--------|--------|
| OPA | corp.alpha.com | Yes |
| OPB | corp.bravo.com | Yes |
| OPC | charlie.local | Yes |
| OPD | delta.local | Yes |
| OPE | echo.corp.com | No |

**Hybrid** = Operation has both local domain GPOs AND shared forest GPOs that apply.

---

## Output Structure

### Executive Mode (7 Tabs)

1. **Summary Dashboard** - Counts by domain, readiness metrics
2. **Operations Summary** - Per-operation bucket breakdown
3. **Settings Overlap** - Cross-domain setting analysis
4. **Enterprise Standards** - Enterprise standard GPOs
5. **Performance Issues** - Empty GPOs, WMI filter problems
6. **Infrastructure Dependencies** - UNC paths, IP references
7. **Consolidation Roadmap** - Recommended timeline

### Domain Mode (5 Tabs)

1. **Bucket Overview** - Summary with navigation
2. **Server GPOs** - Server-targeted policies
3. **Workstation GPOs** - Workstation-targeted policies
4. **User GPOs** - User-targeted policies
5. **Review Required** - Mixed/Unknown/Links-Only GPOs

### Migration Mode (4 Tabs)

1. **Migration Summary** - Counts: MIGRATE / DON'T MIGRATE / REVIEW
2. **GPO Summary** - Per-GPO action with priority (P1-P4)
3. **Settings Analysis** - Every setting with classification
4. **Review Required** - Conflicts needing decision

### Impact Mode (5 Tabs)

1. **Impact Summary** - Per-GPO risk assessment (HIGH/MEDIUM/LOW)
2. **Settings Retained** - Settings unchanged after replacement
3. **Settings Lost** - Settings that will be lost (CRITICAL)
4. **Settings Changed** - Settings with different values (CRITICAL)
5. **Settings Added** - New settings from enterprise baseline

---

## Migration Classifications

| Classification | Meaning | Action |
|----------------|---------|--------|
| **MIGRATE** | Setting unique to operation | Must recreate in new domain |
| **DON'T MIGRATE** | Setting exists in enterprise baseline with same value | Already covered by enterprise standards |
| **REVIEW** | Setting exists in enterprise baseline with DIFFERENT value | Decision required |

### GPO Actions (Migration Mode)

| Action | Definition | Priority |
|--------|------------|----------|
| MIGRATE GPO | All settings are unique - ready to migrate | P1 |
| MIGRATE + REVIEW conflicts | Has unique settings AND conflicts to resolve | P2 |
| MIGRATE (partial overlap) | Some settings overlap but still needs migration | P2 |
| REVIEW conflicts only | No unique settings, only conflicts to review | P3 |
| SKIP (enterprise covers) | All settings already exist in enterprise baseline | P4 |
| SKIP (enterprise managed) | Enterprise Standard GPO - no local action needed | P4 |
| SKIP (enterprise managed - DRIFT DETECTED) | Enterprise Standard GPO differs from baseline | P3 |
| NO SETTINGS (links only) | GPO has no extractable settings | P4 |

### Priority Levels

| Priority | Definition | Action |
|----------|------------|--------|
| P1 | Ready to migrate - most settings are unique | Migrate GPO as-is |
| P2 | Has conflicts - needs resolution before migration | Resolve conflicts, then migrate |
| P3 | Conflicts only or enterprise standard drift detected | Review conflicts/drift only |
| P4 | Skip - enterprise baseline already covers this GPO | Don't migrate |

---

## Architecture

```
gpo_analyzer_v2_3_2.py (backbone - ~6,700 lines)
├── CLI entry point
├── All business logic
├── Excel generation
└── Web API methods

web/
├── backend/
│   ├── app/routers/     → HTTP endpoints (thin)
│   └── app/services/    → Wrapper calls backbone
└── frontend/
    └── src/pages/       → React UI (display only)
```

**Principle:** All logic lives in backbone. Web is display-only wrapper.

---

## Adapt for Your Organization

**See [`SETUP_GUIDE.md`](SETUP_GUIDE.md) for complete step-by-step instructions**, including:

1. Generating GPOZaurr HTML reports for your AD domains
2. Configuring `LOCATION_MAPPING` for your operations (standalone, shared forest, or hybrid)
3. Setting up enterprise standard GPO detection
4. Deploying the web interface with Docker
5. Configuring Entra ID authentication
6. Production deployment with a container registry

### Quick Version

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Edit LOCATION_MAPPING in gpo_analyzer_v2_3_2.py with your operations

# 3. Place GPOZaurr HTML reports in html_reports/

# 4. Run analysis
python gpo_analyzer_v2_3_2.py --mode executive --html-folder ./html_reports --output report.xlsx

# 5. (Optional) Deploy web interface
cd web && docker compose build --no-cache && docker compose up -d
# Access at http://localhost:9845
```

---

## Troubleshooting

### "No GPOs found for operation"
- Verify HTML report exists for that domain
- Check `name_prefixes` match actual GPO naming convention
- Confirm GPOs are Enabled AND Linked

### Web shows different count than CLI
- Rebuild Docker with `--no-cache`
- Verify backbone file copied to `web/backend/`
- Check browser cache (hard refresh)

### Migration mode shows 0 settings
- Verify HTML report has "Group Policy Content" tab
- Check report was generated with settings export enabled

---

## File Structure

```
project/
├── gpo_analyzer_v2_3_2.py      # Backbone (all logic)
├── README.md                    # This file
├── SETUP_GUIDE.md               # Complete setup & deployment guide
├── ARCHITECTURE.md              # System architecture
├── LOCATION_CODES.md            # Operation code reference
├── .env.example                 # Environment variable template
├── html_reports/                # GPOZaurr HTML reports
│   ├── baseline.corp.html
│   ├── corp.alpha.com.html
│   └── ...
└── web/
    ├── docker-compose.yml
    ├── backend/
    │   ├── Dockerfile
    │   └── app/
    │       ├── main.py
    │       ├── routers/
    │       └── services/
    └── frontend/
        ├── Dockerfile
        └── src/
```

---

## Related Documentation

| Document | Purpose |
|----------|---------|
| [`SETUP_GUIDE.md`](SETUP_GUIDE.md) | Complete setup and deployment instructions |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | System architecture overview |
| [`LOCATION_CODES.md`](LOCATION_CODES.md) | Operation code quick reference |
| [`web/README.md`](web/README.md) | Web interface documentation |

---

## License

Portfolio project - Eric Tamez
