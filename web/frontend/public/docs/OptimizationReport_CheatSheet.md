# Optimization Report Quick Reference

**Version:** 1.0 | **GPO Analyzer v2.3.3** | **February 2026**

---

## Buckets At-a-Glance

| Bucket | What It Means | Keywords |
|--------|---------------|----------|
| **Server** | Linked to Server OUs | Server(s) |
| **Workstation** | Linked to Computer OUs | Computer, Workstation, Desktop, Laptop, Client, PC, Kiosk, POS, VDI |
| **User** | Linked to User OUs | User(s), People |
| **Domain Controller** | Linked to DC OU | Domain Controllers |
| **Domain Root** | Linked at domain level | DC=domain,DC=com |
| **Mixed** | Linked to multiple OU types | Multiple keywords |
| **Unknown** | Unrecognized OU names | No keywords match |

---

## Readiness Statuses

| Status | What To Do |
|--------|------------|
| **Ready** | Migrate as-is |
| **Review First** | Check Action column for guidance |
| **Consider Splitting** | Optional optimization |
| **Not Applicable** | Coordinate with AD team |

---

## Action Quick Guide

| Action | What It Means |
|--------|---------------|
| **DON'T MIGRATE: Domain root** | Domain-wide policy - coordinate with enterprise |
| **DON'T MIGRATE: Domain Controller** | DC infrastructure - do not copy |
| **VERIFY: Multi-target** | Check if ALL settings fit ALL targets |
| **REVIEW: Mixed targeting** | Classify Unknown OUs first |
| **REVIEW: Unable to classify** | Manually inspect OU contents |

---

## Bucket vs Applies To

| | Bucket | Applies To |
|-|--------|------------|
| **What** | WHERE linked (OU type) | WHAT settings (Computer/User) |
| **Example** | Server OU | Computer Configuration |

### Valid Combinations

| Bucket | Applies To | Valid? |
|--------|------------|--------|
| Server | Computer | Yes |
| Server | Both | Yes |
| Workstation | Computer | Yes |
| Workstation | Both | Yes |
| User | User | Yes |
| User | Computer | **NO - 100% wasted** |
| User | Both | **Inefficient** |

---

## User GPO Warning

Computer settings in User OUs have **NO EFFECT**.

```
User Bucket + "Computer" = 0% effective
User Bucket + "Both"     = Only User settings apply
```

**Fix:** Move Computer settings to Workstation GPO.

---

## Mixed GPO Decision

```
Is setting appropriate for ALL target types?
├── YES → Keep as multi-target
│         Examples: security baselines, audit policies
│
└── NO  → Split into separate GPOs
          Examples: power settings, app deployment
```

**Rule:** Don't over-split. More GPOs = slower logon.

---

## Tab Workflow

| Tab | Use For |
|-----|---------|
| **1. Overview** | Get counts and scope |
| **2. Server** | Server-linked GPOs |
| **3. Workstation** | Workstation-linked GPOs |
| **4. User** | User-linked GPOs + optimization notes |
| **5. Review Required** | GPOs needing manual decisions |

---

## Review Required Quick Actions

| Bucket | Typical Action |
|--------|----------------|
| **Unknown** | Classify OU, then reassess |
| **Mixed** | Verify intentional or split |
| **Domain Root** | Don't migrate - coordinate |
| **Domain Controller** | Don't migrate - infrastructure |

---

## Common Fixes

| Problem | Solution |
|---------|----------|
| User GPO with Computer settings | Move to Workstation bucket |
| Many Mixed GPOs | Review each; keep security baselines |
| Unknown buckets | Standardize OU naming conventions |
| Links-only detection | Verify GPO ownership |

---

## Export Tips

- **Excel Export** includes all tabs for offline review
- **Click any row** to see full GPO details in side panel
- **Use search** to find specific GPOs quickly

---



---

*Full guide: [Optimization Report Analysis Guide](/help/OptimizationReport_AnalysisGuide)*
