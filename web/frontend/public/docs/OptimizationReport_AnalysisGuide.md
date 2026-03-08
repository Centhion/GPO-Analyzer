# Optimization Report Analysis Guide

**Version:** 1.0 (GPO Analyzer v2.3.3)
**Date:** February 2026
**Purpose:** Analyze and optimize operation-specific GPOs for migration readiness

---

## Overview

The Optimization Dashboard helps you analyze operation-specific GPOs, understand their bucket classifications, and prepare them for migration. This mode excludes enterprise standard policies and focuses solely on operation-owned GPOs.

**Key Principle:** GPOs are classified into "buckets" based on WHERE they are linked (Server OU, Workstation OU, User OU, etc.), not what settings they contain.

---

## Table of Contents

1. [Understanding Buckets](#understanding-buckets)
2. [The Five Tabs](#the-five-tabs)
3. [Readiness Statuses](#readiness-statuses)
4. [Action Types](#action-types)
5. [Applies To vs Bucket](#applies-to-vs-bucket)
6. [Review Required Scenarios](#review-required-scenarios)
7. [Common Patterns](#common-patterns)
8. [Best Practices](#best-practices)

---

## Understanding Buckets

A "bucket" is the classification of a GPO based on the OU type it is linked to.

| Bucket | Description | Keywords Detected |
|--------|-------------|-------------------|
| **Server** | GPO linked to Server OUs | Server, Servers |
| **Workstation** | GPO linked to Workstation/Computer OUs | Computer(s), Workstation(s), Desktop(s), Laptop(s), Client(s), PC(s), Tablet(s), Kiosk(s), POS, Terminal(s), VDI, Thin Client |
| **User** | GPO linked to User OUs | User(s), People |
| **Domain Controller** | GPO linked to Domain Controllers OU | Domain Controllers |
| **Domain Root** | GPO linked at domain level (DC=) | Linked to domain root |
| **Mixed** | GPO linked to multiple OU types | Multiple bucket types detected |
| **Unknown** | GPO linked to unrecognized OUs | No recognized keywords |

### Important Distinction

- **Bucket** = WHERE the GPO is linked (the OU type)
- **Applies To** = WHAT settings the GPO contains (Computer/User/Both)

These are independent. A GPO in the "Server" bucket can contain "Both" Computer and User settings.

---

## The Five Tabs

### Tab 1: Bucket Overview

Shows summary counts and distribution of GPOs across buckets.

| Metric | Description |
|--------|-------------|
| **Total GPOs** | All operation-specific GPOs (excludes enterprise standard GPOs) |
| **Ready to Migrate** | GPOs that can migrate as-is |
| **Needs Review** | GPOs requiring manual inspection |
| **Don't Migrate** | Infrastructure GPOs (Domain Root, DC) |

### Tab 2: Server GPOs

Lists all GPOs linked to Server OUs.

| Column | Description |
|--------|-------------|
| GPO Name | Policy name |
| Linked To | OU path(s) where linked |
| Applies To | Settings type (Computer/User/Both) |
| Settings | Number of configured settings |
| Readiness | Migration readiness status |

**Valid Combinations:**
- Server bucket + Computer settings = Standard server policy
- Server bucket + Both settings = Valid (User settings apply to users who log into servers)

### Tab 3: Workstation GPOs

Lists all GPOs linked to Workstation/Computer OUs.

| Column | Description |
|--------|-------------|
| GPO Name | Policy name |
| Linked To | OU path(s) where linked |
| Applies To | Settings type (Computer/User/Both) |
| Settings | Number of configured settings |
| Readiness | Migration readiness status |

**Valid Combinations:**
- Workstation bucket + Computer settings = Standard workstation policy
- Workstation bucket + Both settings = Valid (User settings apply via loopback or to users who log in)

### Tab 4: User GPOs

Lists all GPOs linked to User OUs.

| Column | Description |
|--------|-------------|
| GPO Name | Policy name |
| Linked To | OU path(s) where linked |
| Applies To | Settings type (Computer/User/Both) |
| Settings | Number of configured settings |
| Optimization Note | Consolidation recommendation |

**Inefficient Combinations:**
- User bucket + Computer settings = 100% WASTED (Computer settings don't apply to user objects)
- User bucket + Both settings = INEFFICIENT (Computer portion has no effect)

**Recommendation:** Move Computer settings to Workstation GPO.

### Tab 5: Review Required

Lists GPOs needing manual inspection due to:
- Unknown bucket (unrecognized OU names)
- Mixed targeting (multiple OU types)
- Domain Root or Domain Controller links
- Links-only detection (name doesn't match operation code)

| Column | Description |
|--------|-------------|
| GPO Name | Policy name |
| Bucket | OU type classification |
| Match Type | How identified (Name Match vs Links Only) |
| Action | Recommended next step |
| Detection Reason | Why bucket was assigned |
| Applies To | Settings type |
| Linked To | OU path(s) |
| Settings | Count |

---

## Readiness Statuses

| Status | Meaning | Action |
|--------|---------|--------|
| **Ready** | Can migrate as-is | Proceed with migration |
| **Review First** | Needs inspection before migration | Check Action column for guidance |
| **Consider Splitting** | Works but could be optimized | Optional: split for cleaner management |
| **Not Applicable** | Should not migrate directly | Work with AD team for equivalent settings |

---

## Action Types

### DON'T MIGRATE Actions

| Action | Reason | What To Do |
|--------|--------|------------|
| **DON'T MIGRATE: Linked at domain root** | Domain Root GPOs apply to ALL objects | Document settings, compare with enterprise standards, coordinate with AD team |
| **DON'T MIGRATE: Domain Controller** | DC GPOs are infrastructure-specific | Do not copy, coordinate with AD team for target DC standards |

### VERIFY Actions

| Action | Reason | What To Do |
|--------|--------|------------|
| **VERIFY: Applies to both Servers and Workstations** | Multi-target GPO | Check if ALL settings appropriate for ALL targets. Keep if security baseline; split if role-specific |
| **VERIFY: Multi-target GPO** | Links to multiple OU types | Determine if intentional broad policy or needs splitting |

### REVIEW Actions

| Action | Reason | What To Do |
|--------|--------|------------|
| **REVIEW: Mixed targeting** | Includes Unknown OUs | Classify Unknown OUs first, then reassess |
| **REVIEW: Mixed User + Computer** | Unusual combination | User settings don't apply to computer objects and vice versa - likely configuration error |
| **REVIEW: Includes Domain Controllers** | Sensitive infrastructure | Verify settings are DC-appropriate, consider dedicated DC GPO |
| **REVIEW: Unable to classify** | Unrecognized OU structure | Manually inspect OUs, classify as Server/Workstation/User |
| **REVIEW: GPO linked to operation OU** | Links-only detection | Verify ownership, check if shared with other operations |

---

## Applies To vs Bucket

Understanding this distinction is critical:

| Scenario | Bucket | Applies To | Valid? | Notes |
|----------|--------|------------|--------|-------|
| Server policy | Server | Computer | Yes | Standard |
| Server policy with user restrictions | Server | Both | Yes | User settings apply to logged-in users |
| Workstation policy | Workstation | Computer | Yes | Standard |
| Workstation policy with user experience | Workstation | Both | Yes | User settings apply via loopback |
| User policy | User | User | Yes | Standard |
| User policy with computer settings | User | Computer | NO | 100% wasted - computer settings don't apply to user objects |
| User policy with mixed | User | Both | Inefficient | Computer portion has no effect |

---

## Review Required Scenarios

### Scenario 1: Unknown Bucket

**Why:** OU names don't match recognized keywords (Server, Workstation, User, etc.)

**Detection Reason Example:** `OU=SpecialSystems,OU=Operations,DC=domain,DC=com`

**Action:**
1. Check what objects are in the OU
2. Determine if they are Servers, Workstations, or Users
3. Consider renaming OU to include keyword, or document decision

### Scenario 2: Mixed Targeting

**Why:** GPO is linked to multiple OU types (e.g., both Server and Workstation OUs)

**Is This Wrong?** Not necessarily. Security baselines SHOULD apply broadly.

**KEEP multi-target if:**
- Security baselines
- Audit policies
- Certificate settings
- Time/network settings

**SPLIT if:**
- Role-specific hardening
- Power settings (different for servers vs workstations)
- User experience settings
- Application deployment

### Scenario 3: Domain Root GPO

**Why:** GPO is linked at the domain level (DC=domain,DC=com), applying to ALL objects.

**Action:** Do NOT migrate directly. These are typically domain-wide policies that need coordination with enterprise standards.

### Scenario 4: Domain Controller GPO

**Why:** GPO is linked to the Domain Controllers OU.

**Action:** Do NOT migrate directly. DC policies are infrastructure-specific and tightly coupled to the source domain.

### Scenario 5: Links-Only Detection

**Why:** GPO name doesn't contain operation code, but it's linked to operation OUs.

**Concern:** Could be a shared GPO used by multiple operations.

**Action:**
1. Verify GPO ownership
2. Check if other operations use it
3. Coordinate before migrating if shared

---

## Common Patterns

### Pattern 1: High "Ready to Migrate" Count

**What It Means:** Most GPOs are properly configured and bucket-appropriate.

**Action:** Proceed with migration planning for these GPOs.

### Pattern 2: Many "User" GPOs with Computer Settings

**What It Means:** Configuration inefficiency - Computer settings in User OUs have no effect.

**Action:** Consider consolidating into Workstation GPOs before migration.

### Pattern 3: Several "Mixed" GPOs

**What It Means:** GPOs apply to multiple OU types.

**Action:** Review each one. Keep if appropriate for all targets; split if role-specific.

### Pattern 4: Unknown Buckets

**What It Means:** OUs don't follow standard naming conventions.

**Action:** Classify OUs manually, consider standardizing OU naming.

---

## Best Practices

1. **Start with Overview** - Understand the scope before diving into details

2. **Address User GPO inefficiencies** - Computer settings in User OUs are wasted. Consolidate into Workstation GPOs for cleaner migration.

3. **Don't over-split Mixed GPOs** - More GPOs = slower logon + more maintenance. Only split if settings are truly role-specific.

4. **Document Unknown decisions** - Future administrators will thank you

5. **Coordinate on Domain Root/DC GPOs** - These need enterprise-level planning, not direct migration

6. **Use the Export** - Download Excel for offline analysis and documentation

7. **Click rows for details** - The side panel shows full GPO settings breakdown

---

---

*GPO Analyzer v2.3.3 | Web Interface v3.3.0*
