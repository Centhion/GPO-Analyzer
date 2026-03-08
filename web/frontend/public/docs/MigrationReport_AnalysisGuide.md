# Migration Report Analysis Guide

**Version:** 2.0 (Updated for GPO Analyzer v2.3.3)
**Date:** January 2026
**Purpose:** Review and approve setting-level migration classifications

---

## Overview

The Migration Report helps you decide which GPO settings need to be migrated from your operation domain to baseline.corp. This guide covers how to interpret the analysis results and make migration decisions.

**Key Principle:** Migration Mode shows ALL Active GPOs (Enabled + Linked), even those without extractable settings. This ensures complete visibility of your migration scope.

---

## Table of Contents

1. [Understanding the Tabs](#understanding-the-tabs)
2. [Classification Definitions](#classification-definitions)
3. [GPO Actions](#gpo-actions)
4. [Priority Levels](#priority-levels)
5. [Enterprise Standard GPO Handling](#enterprise-standard-gpo-handling)
6. [Settings_Analysis Tab](#settings_analysis-tab)
7. [Review_Required Tab](#review_required-tab)
8. [Decision Trees](#decision-trees)
9. [Common Scenarios](#common-scenarios)

---

## Understanding the Tabs

| Tab | Purpose | Action Required |
|-----|---------|-----------------|
| **Migration_Summary** | Classification counts and totals | Overview only |
| **GPO_Summary** | Per-GPO breakdown with actions | Review GPO-level decisions |
| **Settings_Analysis** | Every setting with classification | Reference for details |
| **Review_Required** | Settings needing manual decision | **PRIMARY WORK** |

**Workflow:** Start with GPO_Summary to understand the scope, then work through Review_Required to resolve conflicts.

---

## Classification Definitions

### MIGRATE
**Meaning:** This setting is unique to your operation domain and does not exist in the baseline.corp baseline.

**Action:** The setting must be recreated in baseline.corp (or a new GPO) during migration.

**Example:** A custom firewall rule specific to your resort's network.

---

### DON'T MIGRATE
**Meaning:** This setting already exists in the baseline.corp baseline with the **same value**.

**Action:** No action needed. Enterprise standards already provide this setting.

**Example:** Password complexity requirements that match corporate policy.

---

### REVIEW
**Meaning:** This setting exists in **both** your domain and baseline.corp, but the **values differ**.

**Action:** Manual decision required. You must determine:
- Keep your value (migrate with override)
- Accept enterprise value (don't migrate)
- Create a new standard (escalate)

**Example:** Account lockout threshold is 5 in your domain but 3 in enterprise.

---

## GPO Actions

The GPO_Summary tab shows an action for each GPO. **New in v2.3.3:**

| Action | Priority | Description |
|--------|----------|-------------|
| **MIGRATE GPO** | P1 | All settings are unique - ready to migrate as-is |
| **MIGRATE + REVIEW conflicts** | P2 | Has unique settings AND conflicts requiring resolution |
| **MIGRATE (partial overlap)** | P2 | Some settings overlap with enterprise but still needs migration |
| **REVIEW conflicts only** | P3 | No unique settings - only conflicts to review |
| **SKIP (enterprise covers)** | P4 | All settings already exist in enterprise baseline |
| **SKIP (enterprise managed)** | P4 | Enterprise Standard GPO - enterprise-managed, no local action needed |
| **SKIP (enterprise managed - DRIFT DETECTED)** | P3 | Enterprise Standard GPO that differs from baseline - flag for review |
| **NO SETTINGS (links only)** | P4 | GPO has no extractable settings (empty or links-only) |

---

## Priority Levels

| Priority | Definition | Typical Action |
|----------|------------|----------------|
| **P1** | Ready to migrate - most/all settings are unique | Migrate GPO as-is |
| **P2** | Has conflicts - needs resolution before migration | Resolve conflicts, then migrate |
| **P3** | Conflicts only OR enterprise standard drift detected | Review conflicts/drift, may not need migration |
| **P4** | Skip - enterprise standards already cover this | Don't migrate; archive or delete |

**Work Order:** Address P1 first (quick wins), then P2 (requires analysis), then P3 (review only), skip P4.

---

## Enterprise Standard GPO Handling

**New in v2.3.3:** Enterprise Standard GPOs are now clearly identified and handled separately.

### What are Enterprise Standard GPOs?
Enterprise Standard GPOs are enterprise-managed policies pushed to all domains. Examples:
- ENT - DefaultDomain Policy
- ENT - Domain Controllers
- ENT - Hybrid Azure AD Join
- ENT - LAPS
- ENT - Windows Firewall

### How They're Detected
GPOs matching these patterns are flagged as enterprise-managed:
- Name starts with "ENT -" or "ENT-"
- Name matches known Enterprise Standard GPO list

### Enterprise Standard GPO Actions

| Scenario | Action Shown | What It Means |
|----------|--------------|---------------|
| Enterprise Standard GPO matches enterprise baseline | **SKIP (enterprise managed)** | GPO is identical to enterprise standard. No action needed. |
| Enterprise Standard GPO differs from enterprise baseline | **SKIP (enterprise managed - DRIFT DETECTED)** | Local copy has drifted from enterprise standard. Flag for IT review. |

### Why Drift Detection Matters
Previously, Enterprise Standard GPOs could show "MIGRATE" if they had any local modifications. This was misleading because:
1. Enterprise Standard GPOs are enterprise-managed, not operation-managed
2. Local changes to Enterprise Standard GPOs should be reviewed, not migrated
3. Drift indicates potential compliance issues

**Action for Drift:** Report to Enterprise IT team for investigation. The local domain's Enterprise Standard GPO may have been modified and needs to be resynchronized with the enterprise standard.

---

## Settings_Analysis Tab

This tab shows every extracted setting with its classification.

### Column Reference

| Column | Description |
|--------|-------------|
| **Domain** | Source domain of the GPO |
| **GPO_Name** | Name of the Group Policy Object |
| **Category** | Setting category (SecurityOptions, AuditPolicy, etc.) |
| **Setting_Name** | The specific setting being configured |
| **Setting_Value** | The configured value |
| **Setting_Details** | Additional context (may be empty) |
| **Classification** | MIGRATE, DON'T MIGRATE, or REVIEW |
| **Enterprise_GPO_Match** | If REVIEW, shows the Enterprise Standard GPO with conflicting value |
| **Enterprise_Value** | If REVIEW, shows the enterprise baseline value |

### Filtering Tips
1. Filter by Classification = "REVIEW" to see only conflicts
2. Filter by GPO_Name to see all settings for one GPO
3. Filter by Category to see all settings of a type

---

## Review_Required Tab

This tab contains **only** the settings classified as REVIEW. This is your primary workspace.

### Column Reference

| Column | Description |
|--------|-------------|
| **Domain** | Source domain |
| **GPO_Name** | GPO containing the setting |
| **Category** | Setting category |
| **Setting_Name** | The setting with conflicting values |
| **Your_Value** | Value configured in your domain |
| **Enterprise_Value** | Value in baseline.corp baseline |
| **Enterprise_GPO_Match** | Which Enterprise Standard GPO has the conflicting setting |

### Making Decisions

For each REVIEW setting, you must decide:

1. **Keep Your Value**
   - Your setting is operationally required
   - Document why it differs from enterprise standard
   - Create exception request if needed

2. **Accept Enterprise Value**
   - Enterprise standard is acceptable for your operation
   - No migration action needed for this setting
   - Mark as "DON'T MIGRATE" in your tracking

3. **Escalate**
   - Neither value is correct
   - Propose new enterprise standard
   - Coordinate with Enterprise IT team

---

## Decision Trees

### GPO-Level Decision

```
Is GPO an Enterprise Standard GPO?
├── YES → Does it match enterprise baseline?
│         ├── YES → SKIP (enterprise managed)
│         └── NO  → SKIP (enterprise managed - DRIFT DETECTED)
│                   → Report drift to Enterprise IT
│
└── NO → Does GPO have extractable settings?
         ├── NO  → NO SETTINGS (links only)
         │         → Verify GPO purpose, may be intentionally empty
         │
         └── YES → Are ALL settings unique to your domain?
                   ├── YES → MIGRATE GPO (P1)
                   │
                   └── NO → Are there ANY unique settings?
                            ├── YES → Are there conflicts?
                            │         ├── YES → MIGRATE + REVIEW (P2)
                            │         └── NO  → MIGRATE partial (P2)
                            │
                            └── NO → Are there conflicts?
                                     ├── YES → REVIEW conflicts only (P3)
                                     └── NO  → SKIP (enterprise covers) (P4)
```

### Setting-Level Decision

```
Does setting exist in baseline.corp?
├── NO  → MIGRATE (unique to your operation)
│
└── YES → Are values the same?
          ├── YES → DON'T MIGRATE (enterprise covers)
          │
          └── NO  → REVIEW (conflict requires decision)
                    │
                    └── Is your value operationally required?
                        ├── YES → Keep your value
                        │         → Document exception
                        │         → Migrate with override
                        │
                        └── NO/UNSURE → Accept enterprise value
                                        → No migration needed
```

---

## Common Scenarios

### Scenario 1: Firewall Rules
**Situation:** Your operation has custom firewall rules for local applications.

**Expected Classification:** MIGRATE (unique settings)

**Action:** Document each rule's purpose. These will need to be recreated in the new environment.

---

### Scenario 2: Password Policy Difference
**Situation:** Your domain has password length = 12, enterprise has length = 14.

**Expected Classification:** REVIEW

**Decision Process:**
- Is 12 characters a hard requirement for your operation?
- Can your users adapt to 14 characters?
- If 12 is required: Document exception, plan for override
- If 14 is acceptable: No migration needed for this setting

---

### Scenario 3: Enterprise Standard GPO with Local Changes
**Situation:** "ENT - Windows Firewall" shows DRIFT DETECTED

**Expected Action:** SKIP (enterprise managed - DRIFT DETECTED)

**What Happened:** Someone modified the local copy of an enterprise-managed GPO.

**Resolution:**
1. Document the drift (what changed)
2. Report to Enterprise IT team
3. Determine if change was intentional
4. Either resync to enterprise standard or request official change

---

### Scenario 4: Empty GPO
**Situation:** "SOL - Legacy Policy" shows NO SETTINGS (links only)

**What It Means:** GPO is linked but has no extractable settings. Could be:
- Intentionally empty (placeholder)
- Settings in format not parsed (e.g., preferences vs policies)
- GPO used only for WMI filtering or security filtering

**Action:** Manually verify GPO contents in GPMC. Determine if it serves a purpose.

---

### Scenario 5: Full Enterprise Coverage
**Situation:** "SOL - Password Policy" shows SKIP (enterprise covers)

**What It Means:** Every setting in this GPO already exists in baseline.corp with the same values.

**Action:** No migration needed. This GPO can be archived/deleted after migration.

---

## Best Practices

1. **Start with GPO_Summary** - Get the big picture before diving into settings
2. **Address P1 first** - Quick wins build momentum
3. **Document all REVIEW decisions** - Future auditors will thank you
4. **Verify enterprise standard drift** - Don't ignore DRIFT DETECTED warnings
5. **Check NO SETTINGS GPOs** - They may have WMI filters or other configs
6. **Use the Priority system** - It's designed to optimize your workflow

---

## Quick Reference

| Classification | Count In Your Report | Typical % |
|----------------|---------------------|-----------|
| MIGRATE | Varies | 20-40% |
| DON'T MIGRATE | Varies | 40-60% |
| REVIEW | Varies | 10-30% |

| GPO Action | Expected Count | Notes |
|------------|----------------|-------|
| MIGRATE GPO (P1) | Few | Ready to go |
| MIGRATE + REVIEW (P2) | Several | Most common |
| REVIEW only (P3) | Some | Conflicts only |
| SKIP (P4) | Many | Enterprise handles |
| Enterprise managed | Several | Enterprise standard GPOs |
| NO SETTINGS | Few | Verify manually |

---

## Support

For questions about specific settings or classifications, contact:
- **Migration Planning:** Eric Tamez
- **Enterprise Standards:** Enterprise IT Team

---

*GPO Analyzer v2.3.3 | Web Interface v3.3.0*
