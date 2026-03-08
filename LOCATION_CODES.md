# Location Codes Quick Reference

## Standalone Domains
These domains have their own GPOZaurr HTML file. Use the domain name directly.

| Code | Operation | Domain | Command |
|------|-----------|--------|---------|
| OPA | Operation Alpha | corp.alpha.com | `--domain "corp.alpha.com"` |
| OPB | Operation Bravo | corp.bravo.com | `--domain "corp.bravo.com"` |
| OPC | Operation Charlie | charlie.local | `--domain "charlie.local"` |
| OPD | Operation Delta | delta.local | `--domain "delta.local"` |
| OPE | Operation Echo | echo.corp.com | `--domain "echo.corp.com"` |

---

## Shared Forest Operations (baseline.corp)
These operations share the baseline.corp forest. Use the operation code to filter GPOs by naming convention and OU links.

| Code | Operation | GPO Prefixes | Command |
|------|-----------|--------------|---------|
| OPF | Operation Foxtrot | OPF, Foxtrot | `--domain "OPF"` |
| OPG | Operation Golf | OPG, Golf | `--domain "OPG"` |
| OPH | Operation Hotel | OPH, Hotel | `--domain "OPH"` |
| OPI | Operation India | OPI, India | `--domain "OPI"` |
| OPJ | Operation Juliet | OPJ, Juliet | `--domain "OPJ"` |

---

## How It Works

### Standalone Domains
- Each domain has its own HTML file (e.g., `corp.alpha.com.html`)
- All GPOs in that domain belong to that operation
- Use domain name: `--domain "corp.alpha.com"`

### Shared Forest Operations
- All operations share `baseline.corp.html`
- GPOs are filtered by:
  1. **DisplayName** - Contains operation prefix (e.g., "OPF-Workstation Policy")
  2. **Links** - Linked to operation OUs (e.g., OU=Foxtrot)
- Use operation code: `--domain "OPF"`

---

## Examples

```bash
# Standalone domain
python gpo_analyzer_v2_3_2.py --mode domain --domain "corp.alpha.com" --html-folder ./reports --output "alpha.xlsx"

# Shared forest operation
python gpo_analyzer_v2_3_2.py --mode domain --domain "OPF" --html-folder ./reports --output "foxtrot.xlsx"
```

---

## Required HTML Files

| Operations | Required HTML File |
|------------|------------------------------------------|
| OPA | corp.alpha.com.html |
| OPB | corp.bravo.com.html |
| OPC | charlie.local.html |
| OPD | delta.local.html |
| OPE | echo.corp.com.html |
| OPF, OPG, OPH, OPI, OPJ | baseline.corp.html |

---

**Version 2.3.3**
