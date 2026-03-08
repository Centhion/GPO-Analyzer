# GPO Analyzer - Setup Guide

**For new users deploying GPO Analyzer in their own Active Directory environment.**

This guide walks you through every step: generating the input data, configuring the tool for your AD topology, running your first analysis, deploying the web interface, and setting up authentication.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Understand Your AD Topology](#2-understand-your-ad-topology)
3. [Generate GPOZaurr Reports](#3-generate-gpozaurr-reports)
4. [Configure LOCATION_MAPPING](#4-configure-location_mapping)
5. [Configure Enterprise Standard Detection](#5-configure-enterprise-standard-detection)
6. [Run Your First Analysis (CLI)](#6-run-your-first-analysis-cli)
7. [Deploy the Web Interface](#7-deploy-the-web-interface)
8. [Set Up Authentication (Optional)](#8-set-up-authentication-optional)
9. [Production Deployment](#9-production-deployment)
10. [Customization Reference](#10-customization-reference)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. Prerequisites

### Software

| Requirement | Version | Purpose |
|-------------|---------|---------|
| Python | 3.11+ | Backbone CLI |
| Docker | 20.10+ | Web interface containers |
| Docker Compose | v2+ | Container orchestration |
| Node.js | 20+ | Frontend development only (not needed for Docker deployment) |
| PowerShell | 5.1+ | GPOZaurr report generation (run on a domain-joined Windows machine) |

### Python Dependencies

```bash
pip install pandas openpyxl beautifulsoup4 lxml
```

Or use the provided requirements file:

```bash
pip install -r requirements.txt
```

### AD Environment

- Domain Admin or equivalent read access to each AD domain you want to analyze
- A domain-joined Windows machine (or remote PowerShell access) for running GPOZaurr
- The [GPOZaurr](https://github.com/EvotecIT/GPOZaurr) PowerShell module installed:
  ```powershell
  Install-Module GPOZaurr -Force -Scope CurrentUser
  ```

---

## 2. Understand Your AD Topology

Before configuring, map out your AD environment. GPO Analyzer supports three types of operations:

### Type A: Standalone Domain

An operation with its own AD domain. All GPOs in that domain belong to that operation.

```
corp.newyork.com
├── OU=Servers
│   └── NYC-ServerFirewall (GPO)
├── OU=Workstations
│   └── NYC-WorkstationPolicy (GPO)
└── OU=Users
    └── NYC-UserRestrictions (GPO)
```

**You need:** One GPOZaurr HTML report for this domain.

### Type B: Shared Forest

Multiple operations share a single AD forest. GPOs are distinguished by naming prefix and OU structure.

```
shared.corp (single forest)
├── OU=Chicago
│   ├── OU=Servers
│   │   └── CHI-ServerFirewall (GPO)
│   └── OU=Workstations
│       └── CHI-WorkstationPolicy (GPO)
├── OU=Dallas
│   ├── OU=Servers
│   │   └── DAL-ServerFirewall (GPO)
│   └── OU=Workstations
│       └── DAL-WorkstationPolicy (GPO)
└── ENT - Security Baseline (GPO, applies to all)
```

**You need:** One GPOZaurr HTML report for the entire shared forest. The tool uses `name_prefixes` to split GPOs by operation.

### Type C: Hybrid

An operation with its own standalone domain AND GPOs in the shared forest. Both sets of GPOs apply to that operation's computers/users.

```
corp.newyork.com (standalone)        shared.corp (shared forest)
├── NYC-LocalFirewall (GPO)          ├── NYC-SharedPrinters (GPO)
└── NYC-LocalSecurity (GPO)          └── ENT - Baseline (GPO)
```

**You need:** Two HTML reports (one per domain). Configure `shared_prefixes` to pull matching GPOs from the shared forest.

### Worksheet: Map Your Environment

Fill this out before configuring:

| Operation | Code | Type | Domain(s) | GPO Prefix(es) |
|-----------|------|------|-----------|-----------------|
| _Example: New York_ | _NYC_ | _Standalone_ | _corp.newyork.com_ | _NYC, NewYork_ |
| _Example: Chicago_ | _CHI_ | _Shared Forest_ | _shared.corp_ | _CHI, Chicago_ |
| _Example: Denver_ | _DEN_ | _Hybrid_ | _corp.denver.com + shared.corp_ | _DEN, Denver_ |
| | | | | |
| | | | | |

---

## 3. Generate GPOZaurr Reports

Run GPOZaurr on a domain-joined Windows machine for **each** AD domain. You need one HTML file per domain.

### Basic Command

```powershell
# Generate report for a single domain
Invoke-GPOZaurr -FilePath "C:\Reports\corp.newyork.com.html" -Type All
```

### For Shared Forest

```powershell
# Generate one report for the entire shared forest
Invoke-GPOZaurr -FilePath "C:\Reports\shared.corp.html" -Type All -Forest "shared.corp"
```

### For Multiple Standalone Domains

```powershell
# Run against each domain
Invoke-GPOZaurr -FilePath "C:\Reports\corp.newyork.com.html" -Type All -Domain "corp.newyork.com"
Invoke-GPOZaurr -FilePath "C:\Reports\corp.chicago.com.html" -Type All -Domain "corp.chicago.com"
```

### File Naming Convention

Name each file as `<domain-name>.html`:

```
html_reports/
├── shared.corp.html           # Shared forest (all shared operations)
├── corp.newyork.com.html      # Standalone: New York
├── corp.chicago.com.html      # Standalone: Chicago (if standalone)
└── corp.denver.com.html       # Standalone: Denver (hybrid - local domain)
```

### Verify Your Reports

Each HTML file should contain these tabs (viewable in a browser):
- **GPO List** — all GPOs with Enabled/Linked status
- **Group Policy Content** — GPO settings (required for Migration/Impact modes)
- **GPO Links** — OU link targets (required for bucket classification)

If "Group Policy Content" is missing, Migration Mode will show 0 settings.

### Place Reports

- **CLI usage:** Place HTML files in a folder and pass `--html-folder ./html_reports`
- **Web interface:** Upload via the Upload page, or mount the folder in Docker

---

## 4. Configure LOCATION_MAPPING

Open `gpo_analyzer_v2_3_2.py` and find the `LOCATION_MAPPING` dictionary (around line 1137). Replace the sample operations with your own.

### LOCATION_MAPPING Fields

| Field | Required | Description |
|-------|----------|-------------|
| `full_name` | Yes | Display name for the operation (e.g., "New York Office") |
| `source_domain` | Yes | AD domain where this operation's GPOs live. For shared forest operations, this is the shared forest domain name. |
| `target_domain` | Yes | Usually same as `source_domain`. Used for migration target references. |
| `name_prefixes` | For shared forest | List of GPO name prefixes that identify this operation's GPOs within the shared forest (e.g., `['NYC', 'NewYork']`). |
| `shared_prefixes` | For hybrid only | List of prefixes to pull matching GPOs from the shared forest into this standalone operation's report. |

### Example: Standalone Domain

```python
'NYC': {
    'full_name': 'New York Office',
    'source_domain': 'corp.newyork.com',
    'target_domain': 'corp.newyork.com',
},
```

No `name_prefixes` needed — all GPOs in `corp.newyork.com` belong to this operation.

### Example: Shared Forest Operation

```python
'CHI': {
    'full_name': 'Chicago Office',
    'source_domain': 'shared.corp',
    'target_domain': 'shared.corp',
    'name_prefixes': ['CHI', 'Chicago'],
},
```

GPOs in `shared.corp` whose DisplayName starts with "CHI" or "Chicago" (e.g., "CHI-ServerFirewall", "Chicago Printers") are assigned to this operation.

### Example: Hybrid Operation

```python
'DEN': {
    'full_name': 'Denver Office',
    'source_domain': 'corp.denver.com',
    'target_domain': 'corp.denver.com',
    'name_prefixes': ['DEN', 'Denver'],
    'shared_prefixes': ['DEN', 'Denver'],
},
```

Gets GPOs from both `corp.denver.com` AND matching GPOs from the shared forest.

### Update SHARED_FOREST_OPERATIONS

List all operation codes whose `source_domain` is the shared forest:

```python
SHARED_FOREST_OPERATIONS = ['CHI', 'DAL', 'HOU']  # All shared forest operation codes
```

### Update the Shared Forest Domain Name

Search and replace `baseline.corp` throughout the file with your actual shared forest domain name (e.g., `shared.corp`, `enterprise.ad`, `corp.hq.com`).

Quick way to verify:
```bash
grep -n "baseline.corp" gpo_analyzer_v2_3_2.py | head -20
```

---

## 5. Configure Enterprise Standard Detection

Enterprise Standard GPOs are centrally managed policies that apply across all operations (e.g., security baselines, compliance policies). The tool detects them by GPO name prefix.

### Default Behavior

The function `is_enterprise_standard_gpo()` (line ~681) matches GPO names containing `ENT` as a prefix:

```
ENT - Security Baseline     → detected as Enterprise Standard
ENT-Firewall-Policy          → detected as Enterprise Standard
NYC-ServerFirewall            → NOT detected (operation-specific)
```

### Customize the Prefix

If your enterprise standard GPOs use a different naming convention, edit the regex in `is_enterprise_standard_gpo()`:

```python
# Default: matches "ENT" prefix
return bool(re.search(r'(?:^|[\s\-_])ENT(?:[\s\-_]|$)', str(gpo_name), re.IGNORECASE))

# Example: match "GLOBAL" prefix instead
return bool(re.search(r'(?:^|[\s\-_])GLOBAL(?:[\s\-_]|$)', str(gpo_name), re.IGNORECASE))

# Example: match multiple prefixes
return bool(re.search(r'(?:^|[\s\-_])(?:ENT|GLOBAL|HQ)(?:[\s\-_]|$)', str(gpo_name), re.IGNORECASE))
```

### If You Don't Have Enterprise Standard GPOs

If your organization doesn't distinguish enterprise-wide GPOs from operation-specific ones, you can leave the function as-is. It will simply never match, and all GPOs will be treated as operation-specific. This only affects Migration and Impact modes.

---

## 6. Run Your First Analysis (CLI)

### Executive Mode (Start Here)

Get a high-level overview across all operations:

```bash
python gpo_analyzer_v2_3_2.py \
  --mode executive \
  --html-folder ./html_reports \
  --output executive_report.xlsx
```

This produces a 7-tab Excel workbook with:
- Summary dashboard with per-domain GPO counts
- Operations summary with bucket breakdowns
- Cross-domain settings overlap
- Enterprise standard GPO inventory
- Performance issues (empty GPOs, WMI filter problems)
- Infrastructure dependencies (UNC paths, IP references)
- Consolidation roadmap

### Domain Mode

Deep dive into a single operation:

```bash
# By domain name (standalone operations)
python gpo_analyzer_v2_3_2.py \
  --mode domain \
  --domain "corp.newyork.com" \
  --html-folder ./html_reports \
  --output nyc_domain.xlsx

# By operation code (shared forest operations)
python gpo_analyzer_v2_3_2.py \
  --mode domain \
  --operation CHI \
  --html-folder ./html_reports \
  --output chi_domain.xlsx
```

### Migration Mode

Compare an operation's settings against the shared forest baseline:

```bash
python gpo_analyzer_v2_3_2.py \
  --mode migration \
  --domain "corp.newyork.com" \
  --html-folder ./html_reports \
  --output nyc_migration.xlsx
```

Classifies every setting as MIGRATE, DON'T MIGRATE, or REVIEW.

### Impact Mode

What happens when you replace operation GPOs with enterprise standards:

```bash
python gpo_analyzer_v2_3_2.py \
  --mode impact \
  --domain "corp.newyork.com" \
  --html-folder ./html_reports \
  --output nyc_impact.xlsx
```

Shows settings retained, lost, changed, and added.

### Full Mode

Complete raw data dump (19 tabs):

```bash
python gpo_analyzer_v2_3_2.py \
  --mode full \
  --html-folder ./html_reports \
  --output full_report.xlsx
```

---

## 7. Deploy the Web Interface

The web interface provides a browser-based dashboard for Executive, Domain, and Migration modes.

### Quick Start (Local Docker)

```bash
cd web
docker compose build --no-cache
docker compose up -d
```

Access at **http://localhost:9845**

### How It Works

- The backbone (`gpo_analyzer_v2_3_2.py`) is **copied into the container image** at build time
- HTML reports are mounted as a volume from `html_reports/`
- Frontend (React/nginx) runs on port 9845
- Backend (FastAPI/uvicorn) runs on port 8000 internally

### Upload Reports

Two options:
1. **Mount folder:** Place HTML files in `html_reports/` before starting containers
2. **Web upload:** Use the Upload page in the web interface

### Rebuild After Configuration Changes

Any time you edit `gpo_analyzer_v2_3_2.py`, rebuild the containers:

```bash
cd web
docker compose down
docker compose build --no-cache
docker compose up -d
```

---

## 8. Set Up Authentication (Optional)

The web interface supports Entra ID (Azure AD) authentication. Skip this section if you want unauthenticated access.

### Step 1: Register an App in Entra ID

1. Go to **Azure Portal > App Registrations > New Registration**
2. Name: `GPO Analyzer` (or your preference)
3. Supported account types: **Single tenant**
4. Redirect URI: **Single-page application (SPA)** → `http://localhost:9845/`
5. Note the **Application (client) ID** and **Directory (tenant) ID**

### Step 2: Configure API Permissions

1. Go to **API Permissions > Add a permission**
2. Add: `Microsoft Graph > Delegated > User.Read, openid, profile, email`
3. Click **Grant admin consent**

### Step 3: Set Environment Variables

Copy `.env.example` to `.env` in the project root:

```bash
cp .env.example .env
```

Edit `.env`:

```ini
AZURE_TENANT_ID=your-actual-tenant-id
AZURE_CLIENT_ID=your-actual-client-id
AUTH_ENABLED=true
```

### Step 4: Rebuild and Deploy

```bash
cd web
docker compose down
docker compose build --no-cache
docker compose up -d
```

The web interface will now require Entra ID login.

### Disable Authentication

Set `AUTH_ENABLED=false` in `.env` (or omit the variable entirely — it defaults to false).

---

## 9. Production Deployment

### Production Checklist

- [ ] HTML reports mounted or uploaded
- [ ] `LOCATION_MAPPING` configured for your operations
- [ ] `SHARED_FOREST_OPERATIONS` updated
- [ ] Enterprise standard prefix configured (if applicable)
- [ ] Shared forest domain name updated (replaced `baseline.corp`)
- [ ] Authentication configured (if needed)
- [ ] Ports 80 (frontend) available
- [ ] CORS origins in `main.py` updated for production URL

### Reverse Proxy (Optional)

If deploying behind nginx, Traefik, or another reverse proxy:

```nginx
# Example nginx config
server {
    listen 443 ssl;
    server_name gpo-analyzer.yourdomain.com;

    location / {
        proxy_pass http://localhost:9845;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Update CORS origins in `web/backend/app/main.py` to include your production URL.

---

## 10. Customization Reference

### Files You Must Edit

| File | What to Change |
|------|----------------|
| `gpo_analyzer_v2_3_2.py` | `LOCATION_MAPPING`, `SHARED_FOREST_OPERATIONS`, shared forest domain name, `is_enterprise_standard_gpo()` prefix |

### Files You May Want to Edit

| File | What to Change |
|------|----------------|
| `web/backend/app/main.py` | CORS origins for production |
| `web/frontend/src/authConfig.ts` | Already uses env vars, no changes needed unless customizing scopes |
| `.env` | Authentication credentials |

### Files You Should NOT Edit

| File | Why |
|------|-----|
| `web/backend/app/services/analyzer.py` | Thin wrapper, delegates to backbone |
| `web/backend/app/routers/*.py` | HTTP plumbing, no business logic |
| `web/frontend/src/pages/*.tsx` | Display layer, reads from API |

### Bucket Classification Keywords

GPOs are classified by OU link targets. Edit the keyword lists (around line 1163) if your OU naming differs:

```python
# Default keywords (case-insensitive)
Server bucket:      "Server", "Servers", "MemberServer"
Workstation bucket: "Workstation", "Workstations", "Computer", "Computers", "Desktop"
User bucket:        "User", "Users", "People"
DC bucket:          "Domain Controller", "Domain Controllers"
```

---

## 11. Troubleshooting

### "No HTML files found"
- Verify HTML files exist in the folder passed to `--html-folder`
- Check file extension is `.html` (not `.htm`)

### "No GPOs found for operation"
- Check `name_prefixes` in LOCATION_MAPPING match your GPO naming convention
- Verify GPOs are both **Enabled** and **Linked** (GPO Analyzer filters out disabled/unlinked GPOs)
- Open the HTML file in a browser and check the "GPO List" tab

### Migration mode shows 0 settings
- The HTML report must contain a "Group Policy Content" tab
- Re-run GPOZaurr with `-Type All` to include settings

### Web shows different count than CLI
- Rebuild Docker: `docker compose build --no-cache`
- Clear browser cache (Ctrl+Shift+R)
- Check `docker compose logs backend` for errors

### "Operation not found" in Domain Mode
- Operation code is case-sensitive — must match LOCATION_MAPPING key exactly
- Run `python gpo_analyzer_v2_3_2.py --help` to see valid operation codes

### Container won't start
```bash
docker compose logs backend    # Check for Python import errors
docker compose logs frontend   # Check for nginx config errors
```

### CORS errors in browser
- Edit `web/backend/app/main.py` and add your URL to the CORS origins list
- Rebuild containers after changing

---

## Quick Reference: End-to-End Example

```bash
# 1. Clone the repo
git clone https://github.com/your-username/gpo-analyzer.git
cd gpo-analyzer

# 2. Install CLI dependencies
pip install -r requirements.txt

# 3. Edit LOCATION_MAPPING in gpo_analyzer_v2_3_2.py
#    (see Section 4 above)

# 4. Place GPOZaurr HTML reports
cp /path/to/reports/*.html ./html_reports/

# 5. Run executive analysis
python gpo_analyzer_v2_3_2.py \
  --mode executive \
  --html-folder ./html_reports \
  --output executive_report.xlsx

# 6. Deploy web interface
cd web
docker compose build --no-cache
docker compose up -d
# Open http://localhost:9845

# 7. (Optional) Run migration analysis for a specific domain
python gpo_analyzer_v2_3_2.py \
  --mode migration \
  --domain "corp.newyork.com" \
  --html-folder ./html_reports \
  --output nyc_migration.xlsx
```
