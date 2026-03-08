// API Response Types - matching backend schemas

export interface BucketMetrics {
  bucket: string;
  count: number;
  percentage: number;
}

export interface MigrationDashboard {
  total_gpos: number;
  active_gpos: number;
  active_percentage: number;
  migration_ready: number;
  migration_ready_percentage: number;
  needs_review: number;
  dont_migrate: number;
  bucket_distribution: BucketMetrics[];
  domains_analyzed: number;
  operations_count: number;
}

export interface OperationSummary {
  operation: string;
  full_name: string;
  operation_type: 'Shared Forest' | 'Standalone';
  total_gpos: number;
  server: number;
  workstation: number;
  user: number;
  mixed: number;
  unknown: number;
  domain_controller: number;
  domain_root: number;
  migrate_ready: number;
  needs_review: number;
  dont_migrate: number;
  readiness_percentage: number;
}

export interface RiskAssessmentRow {
  operation: string;
  full_name: string;
  total_gpos: number;
  risk_score: number;
  risk_level: 'HIGH' | 'MEDIUM' | 'LOW';
  mixed_count: number;
  unknown_count: number;
  dc_count: number;
  domain_root_count: number;
  risk_notes: string;
}

export interface BucketComparisonRow {
  operation: string;
  full_name: string;
  total_gpos: number;
  server_pct: number;
  workstation_pct: number;
  user_pct: number;
  mixed_pct: number;
  other_pct: number;
}

export interface DomainBucketOverview {
  operation: string;
  full_name: string;
  total_gpos: number;
  bucket_counts: Record<string, number>;
  migration_summary: {
    MIGRATE: number;
    "DON'T MIGRATE": number;
    REVIEW: number;
  };
}

export interface GPORow {
  gpo_name: string;
  description: string | null;
  linked_to: string;
  applies_to: 'Computer' | 'User' | 'Both' | 'Unknown';
  settings_count: number;
  size_mb: string | null;
  created: string | null;
  last_modified: string | null;
  guid: string | null;
  bucket: string;
  match_type: string;
  readiness: 'Ready' | 'Review First' | 'Consider Splitting' | 'Not Applicable';
  optimization_note: string | null;
  detection_reason: string | null;  // Explains why bucket was assigned
  action: string | null;  // For Review Required tab
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface AvailableOperation {
  code: string;
  full_name: string;
  source_domain: string;
  operation_type: 'Shared Forest' | 'Standalone';
  gpo_count: number;
}

export interface OperationsListResponse {
  operations: AvailableOperation[];
  total_operations: number;
  total_gpos: number;
}

export interface HealthResponse {
  status: string;
  version: string;
  html_files_count: number;
  last_analysis: string | null;
}

export interface UploadedFile {
  filename: string;
  size_kb: number;
  modified: number;
}

// UI State Types
export type DashboardMode = 'executive' | 'domain';

export interface TabConfig {
  id: string;
  label: string;
  shortLabel?: string;
}

// ============================================================================
// GPO Details Types (Settings Drill-Down)
// ============================================================================

export interface GPOSetting {
  category: string;
  setting_name: string;
  setting_value: string;
}

export interface GPOIssue {
  severity: 'warning' | 'info' | 'error';
  message: string;
  detail?: string;
}

export interface GPODetails {
  gpo_name: string;
  guid: string | null;
  description: string | null;
  applies_to: string;
  bucket: string;
  readiness: string;
  match_type: string;
  created: string | null;
  last_modified: string | null;
  link_locations: string[];
  settings: GPOSetting[];
  settings_count: number;
  issues: GPOIssue[];
  detection_reason: string | null;
  action: string | null;
}

// ============================================================================
// Migration Mode Types
// ============================================================================

export interface MigrationDomain {
  domain: string;
  display_name: string;
  domain_type: string;
  gpo_count: number;
  unmatched_gpos?: string[];  // Only present for _UNMATCHED domain
}

export interface MigrationDomainsResponse {
  domains: MigrationDomain[];
  enterprise_baseline: string;
}

export interface GPOSummaryRow {
  priority: string;
  action: string;
  operation_gpo: string;
  source_domain?: string;  // Source domain (e.g., corp.alpha.com, baseline.corp)
  enterprise_standard_overlap: string;
  shared_forest_overlap: string;
  total_settings: number;
  migrate: number;
  dont_migrate: number;
  review: number;
  dn_path?: string;  // Full DN path (Links) - present for Enterprise-Wide GPOs
}

export interface MigrationSummaryData {
  domain: string;
  total_settings: number;
  migrate: number;
  dont_migrate: number;
  review: number;
  total_gpos: number;
  p1_count: number;
  p2_count: number;
  p3_count: number;
  p4_count: number;
  gpo_summary: GPOSummaryRow[];
  warning?: string;  // Optional warning message
}
