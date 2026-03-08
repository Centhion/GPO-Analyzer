# Migration Report Quick Reference

**Version:** 2.0 | **GPO Analyzer v2.3.3** | **January 2026**

---

## Classifications At-a-Glance

| Classification | Meaning | Action |
|----------------|---------|--------|
| **MIGRATE** | Setting unique to your domain | Must recreate in baseline.corp |
| **DON'T MIGRATE** | Enterprise already has this (same value) | No action needed |
| **REVIEW** | Both have it, values differ | Manual decision required |

---

## GPO Actions (v2.3.3)

| Action | Priority | What To Do |
|--------|----------|------------|
| **MIGRATE GPO** | P1 | Migrate as-is (all settings unique) |
| **MIGRATE + REVIEW conflicts** | P2 | Resolve conflicts, then migrate |
| **MIGRATE (partial overlap)** | P2 | Some overlap, still needs migration |
| **REVIEW conflicts only** | P3 | Only conflicts to review, no unique settings |
| **SKIP (enterprise covers)** | P4 | Don't migrate (enterprise handles all) |
| **SKIP (enterprise managed)** | P4 | Enterprise Standard GPO - enterprise standard, no action |
| **SKIP (enterprise managed - DRIFT DETECTED)** | P3 | Enterprise Standard GPO differs from baseline - flag for IT review |
| **NO SETTINGS (links only)** | P4 | GPO has no extractable settings - verify manually |

---

## Priority Work Order

| Priority | Focus | Effort |
|----------|-------|--------|
| **P1** | Quick wins - migrate as-is | Low |
| **P2** | Resolve conflicts, then migrate | Medium |
| **P3** | Review conflicts/drift only | Medium |
| **P4** | Skip - no migration action | None |

---

## Decision Trees

### For Each Setting (REVIEW)

```
Is your value operationally required?
├── YES → Keep your value, document exception
└── NO  → Accept enterprise value
```

### For Each GPO

```
Is it an Enterprise Standard GPO?
├── YES → Does it match enterprise?
│         ├── YES → SKIP (enterprise managed)
│         └── NO  → Report drift to Enterprise IT
└── NO  → Check action in GPO_Summary tab
```

---

## Enterprise Standard GPO Handling (New in v2.3.3)

**Enterprise Standard GPOs** = Enterprise-managed standard policies (start with "ENT -")

| Scenario | Action | You Should |
|----------|--------|------------|
| Matches enterprise | SKIP (enterprise managed) | Nothing - it's standard |
| Differs from enterprise | DRIFT DETECTED | Report to Enterprise IT |

**Why Drift Matters:** Local changes to Enterprise Standard GPOs indicate potential compliance issues. Don't migrate - report for investigation.

---

## Zero-Settings GPOs (New in v2.3.3)

GPOs showing **NO SETTINGS (links only)** may be:
- Intentionally empty (placeholders)
- Using WMI filters only
- Containing settings not parsed

**Action:** Manually verify in GPMC before deciding.

---

## Tab Quick Guide

| Tab | Use For |
|-----|---------|
| **Migration_Summary** | Get the big picture (counts) |
| **GPO_Summary** | Understand each GPO's status |
| **Settings_Analysis** | Deep dive into specific settings |
| **Review_Required** | **Your main workspace** - resolve conflicts |

---

## Workflow

1. **Start:** GPO_Summary → understand scope
2. **Work:** Review_Required → resolve each REVIEW
3. **Document:** Track decisions and exceptions
4. **Verify:** Check enterprise standard drift and zero-settings GPOs
5. **Complete:** Export and share with migration team

---

## Key Columns

### GPO_Summary Tab
- **GPO Name** - The policy
- **Action** - What to do (MIGRATE/SKIP/REVIEW)
- **Priority** - Work order (P1-P4)
- **MIGRATE/REVIEW/SKIP counts** - Setting breakdown

### Review_Required Tab
- **Your_Value** - What you have
- **Enterprise_Value** - What enterprise has
- **Enterprise_GPO_Match** - Which Enterprise Standard GPO conflicts

---

## Common Patterns

| You See | It Means | Do This |
|---------|----------|---------|
| 80% DON'T MIGRATE | Enterprise covers most | Focus on the 20% |
| Many REVIEW | Value conflicts | Work through decisions |
| ENT DRIFT | Local GPO modified | Report to Enterprise IT |
| NO SETTINGS | Empty/unparsed GPO | Check GPMC manually |

---

## Support

**Migration:** Eric Tamez
**Enterprise Standards:** Enterprise IT Team

---

*Full guide: [Migration Report Analysis Guide](/help/MigrationReport_AnalysisGuide)*
