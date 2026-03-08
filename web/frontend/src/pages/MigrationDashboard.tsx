import { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Download, AlertTriangle, CheckCircle, XCircle, HelpCircle, ChevronDown, ChevronUp, FileSpreadsheet, Info, FileText } from 'lucide-react';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { TabNavigation } from '../components/common/TabNavigation';
import { DataTable, createColumn } from '../components/common/DataTable';
import { getMigrationDomains, getMigrationSummary, downloadMigrationExcel } from '../services/api';
import type { MigrationDomain, MigrationSummaryData, TabConfig, GPOSummaryRow } from '../types';

const TABS: TabConfig[] = [
  { id: 'summary', label: 'Migration Summary' },
  { id: 'gpo', label: 'GPO Summary' },
  { id: 'settings', label: 'Settings Analysis' },
  { id: 'review', label: 'Review Required' },
];

// ============================================================================
// Migration Legend - Explains priority, actions, and columns
// ============================================================================

const MIGRATION_LEGEND = {
  priorities: [
    { code: 'P1', label: 'Migrate', color: 'bg-green-100 text-green-800', action: 'MIGRATE GPO / MIGRATE (partial overlap)', meaning: 'All or most settings are unique to this operation. Copy these settings to baseline.corp.' },
    { code: 'P2', label: 'Migrate + Decide', color: 'bg-amber-100 text-amber-800', action: 'MIGRATE + REVIEW conflicts', meaning: 'Has unique settings to migrate, BUT some settings conflict with baseline.corp (different values). Review conflicts first, decide which value to keep, then migrate.' },
    { code: 'P3', label: 'Decide Only', color: 'bg-orange-100 text-orange-800', action: 'REVIEW conflicts only', meaning: 'No unique settings to migrate, but baseline.corp has different values for some settings. Verify enterprise values are correct for this operation.' },
    { code: 'P4', label: 'No Action', color: 'bg-gray-100 text-gray-800', action: 'SKIP (enterprise covers)', meaning: 'Enterprise.ad already has all these settings with matching values. Nothing to migrate.' },
  ],
  columns: [
    { name: 'Enterprise Overlap', meaning: 'Enterprise Standard GPOs in baseline.corp that contain the same settings. These drive DONT_MIGRATE and REVIEW classifications.' },
    { name: 'Shared Forest Overlap', meaning: 'Other operation GPOs in baseline.corp (WP-*, STR-*, etc.) that share settings. Informational only - does NOT affect migration classification.' },
    { name: 'Settings', meaning: 'Total settings in this GPO.' },
    { name: 'Migrate', meaning: 'Settings unique to this operation - need to be added to baseline.corp.' },
    { name: "Don't", meaning: 'Settings already in baseline.corp with matching values - no action needed.' },
    { name: 'Review', meaning: 'Settings that exist in both but have DIFFERENT values - manual decision required.' },
  ],
  tips: [
    '💡 Start with P1 GPOs - they have the cleanest migration path',
    '⚠️ P2 GPOs require conflict resolution before migration',
    '🔍 Click column headers to sort by any field',
    '📊 Hover over Enterprise/Shared Forest overlap counts to see specific GPO names',
    '📥 Use "Export Excel" for full setting-level detail in Settings_Analysis tab',
  ],
};

function MigrationLegend() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="mb-4 bg-warm-50 border border-warm-200 rounded-lg">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-2 text-left hover:bg-warm-100 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-2 text-gray-700">
          <Info className="h-4 w-4 text-primary-500" />
          <span className="font-medium text-sm">Legend & Guide</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-gray-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-500" />
        )}
      </button>
      
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-warm-200">
          {/* Priority Guide */}
          <div className="mt-3">
            <h4 className="text-xs font-semibold text-gray-700 mb-2">PRIORITY & ACTION GUIDE</h4>
            <div className="space-y-2">
              {MIGRATION_LEGEND.priorities.map((p) => (
                <div key={p.code} className="flex items-start gap-2 text-xs">
                  <span className={`inline-flex px-2 py-0.5 rounded font-semibold ${p.color} flex-shrink-0`}>
                    {p.code}
                  </span>
                  <div>
                    <span className="font-medium text-gray-800">{p.label}</span>
                    <span className="text-gray-500 mx-1">→</span>
                    <span className="text-gray-600">{p.meaning}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Column Explanations */}
          <div className="mt-4 pt-3 border-t border-warm-200">
            <h4 className="text-xs font-semibold text-gray-700 mb-2">COLUMN DEFINITIONS</h4>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              {MIGRATION_LEGEND.columns.map((col) => (
                <div key={col.name}>
                  <span className="font-medium text-gray-800">{col.name}:</span>{' '}
                  <span className="text-gray-600">{col.meaning}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Tips */}
          <div className="mt-4 pt-3 border-t border-warm-200">
            <h4 className="text-xs font-semibold text-gray-700 mb-2">TIPS</h4>
            <div className="space-y-1">
              {MIGRATION_LEGEND.tips.map((tip, idx) => (
                <p key={idx} className="text-xs text-gray-600">{tip}</p>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function MigrationDashboard() {
  const [domains, setDomains] = useState<MigrationDomain[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [summary, setSummary] = useState<MigrationSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState('summary');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDomains();
  }, []);

  const loadDomains = async () => {
    try {
      setLoading(true);
      const data = await getMigrationDomains();
      setDomains(data.domains);
      if (data.domains.length > 0) {
        setSelectedDomain(data.domains[0].domain);
      }
    } catch (err) {
      setError('Failed to load domains');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const runAnalysis = async () => {
    if (!selectedDomain) return;
    
    try {
      setAnalyzing(true);
      setError(null);
      const data = await getMigrationSummary(selectedDomain);
      setSummary(data);
    } catch (err: any) {
      const errorMsg = err?.response?.data?.detail || err?.message || 'Migration analysis failed';
      setError(errorMsg);
      console.error('Migration error:', err);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleExport = async () => {
    if (!selectedDomain) return;
    try {
      setError(null);
      await downloadMigrationExcel(selectedDomain);
    } catch (err: any) {
      const errorMsg = err?.response?.data?.detail || err?.message || 'Export failed';
      setError(errorMsg);
      console.error('Export error:', err);
    }
  };

  const selectedDomainInfo = domains.find(d => d.domain === selectedDomain);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="py-6">
      {/* Header with Synopsis */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Migration Mode</h1>
        <p className="text-gray-600 mb-3">
          Setting-level comparison against baseline.corp baseline
        </p>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
          <strong>📊 What this shows:</strong> Analyzes ALL GPOs in the selected domain (including enterprise standard copies) 
          to identify setting-level differences from baseline.corp. Use this to understand migration scope 
          and identify configuration drift. GPO counts shown are <strong>all GPOs</strong> in the domain.
        </div>
        
        {/* Documentation Links */}
        <div className="mt-3 flex items-center gap-4 text-sm">
          <span className="text-gray-500">Analysis Guides:</span>
          <a
            href="/help/MigrationReport_AnalysisGuide"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
          >
            <FileText className="h-4 w-4" />
            Full Guide
          </a>
          <a
            href="/help/MigrationReport_CheatSheet"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
          >
            <FileText className="h-4 w-4" />
            Quick Reference
          </a>
        </div>
      </div>

      {/* Domain Selection & Actions */}
      <div className="bg-white rounded-lg shadow-sm border border-warm-200 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          {/* Domain Dropdown */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Operation Domain
            </label>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-warm-300 rounded-lg hover:bg-warm-50 min-w-[250px] justify-between"
            >
              <span>
                {selectedDomainInfo ? (
                  <>
                    <span className="font-medium">{selectedDomainInfo.display_name}</span>
                    <span className="text-gray-500 text-sm ml-2">
                      ({selectedDomainInfo.gpo_count} GPOs - all)
                    </span>
                  </>
                ) : (
                  'Select domain...'
                )}
              </span>
              <ChevronDown className={`h-4 w-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {dropdownOpen && (
              <div className="absolute top-full left-0 mt-1 w-full bg-white rounded-lg shadow-lg border border-warm-200 py-2 z-50 max-h-64 overflow-auto">
                {domains.map((d) => (
                  <button
                    key={d.domain}
                    onClick={() => {
                      setSelectedDomain(d.domain);
                      setDropdownOpen(false);
                      setSummary(null);
                    }}
                    className={`block w-full text-left px-4 py-2 hover:bg-warm-100 ${
                      selectedDomain === d.domain ? 'bg-primary-50 text-primary-700' : ''
                    }`}
                  >
                    <div className="font-medium">{d.display_name}</div>
                    <div className="text-xs text-gray-500">
                      {d.domain} • {d.gpo_count} GPOs (all)
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-end gap-2">
            <button
              onClick={runAnalysis}
              disabled={!selectedDomain || analyzing}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium ${
                analyzing
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-primary-600 text-white hover:bg-primary-700'
              }`}
            >
              {analyzing ? (
                <>
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <FileSpreadsheet className="h-4 w-4" />
                  Run Analysis
                </>
              )}
            </button>

            <button
              onClick={handleExport}
              disabled={!selectedDomain}
              className="flex items-center gap-2 px-4 py-2 border border-warm-300 rounded-lg hover:bg-warm-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="h-4 w-4" />
              Export Excel
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Click outside to close dropdown */}
      {dropdownOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
      )}

      {/* Results */}
      {summary && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <SummaryCard
              icon={<CheckCircle className="h-6 w-6 text-green-600" />}
              label="MIGRATE"
              value={summary.migrate}
              total={summary.total_settings}
            />
            <SummaryCard
              icon={<XCircle className="h-6 w-6 text-gray-600" />}
              label="DON'T MIGRATE"
              value={summary.dont_migrate}
              total={summary.total_settings}
            />
            <SummaryCard
              icon={<AlertTriangle className="h-6 w-6 text-amber-600" />}
              label="REVIEW"
              value={summary.review}
              total={summary.total_settings}
            />
            <SummaryCard
              icon={<HelpCircle className="h-6 w-6 text-blue-600" />}
              label="Total Settings"
              value={summary.total_settings}
              total={summary.total_settings}
            />
          </div>

          {/* GPO Priority Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <PriorityCard priority="P1" label="Ready to Migrate" count={summary.p1_count} color="green" />
            <PriorityCard priority="P2" label="Migrate + Resolve" count={summary.p2_count} color="amber" />
            <PriorityCard priority="P3" label="Audit Conflicts" count={summary.p3_count} color="orange" />
            <PriorityCard priority="P4" label="Skip (Covered)" count={summary.p4_count} color="gray" />
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-lg shadow-sm border border-warm-200">
            <TabNavigation
              tabs={TABS}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />

            <div className="p-4">
              {activeTab === 'summary' && (
                <MigrationSummaryTab summary={summary} />
              )}
              {activeTab === 'gpo' && (
                <GPOSummaryTab gpoSummary={summary.gpo_summary} />
              )}
              {activeTab === 'settings' && (
                <div className="text-gray-500 text-center py-8">
                  Settings Analysis data available in Excel export
                </div>
              )}
              {activeTab === 'review' && (
                <div className="text-gray-500 text-center py-8">
                  Review Required data available in Excel export
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Initial state */}
      {!summary && !analyzing && (
        <div className="bg-white rounded-lg shadow-sm border border-warm-200 p-8 text-center">
          <FileSpreadsheet className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-700 mb-2">
            Ready to Analyze
          </h3>
          <p className="text-gray-500 mb-4">
            Select a domain and click "Run Analysis" to compare settings against baseline.corp
          </p>
        </div>
      )}
    </div>
  );
}

// Summary Card Component
function SummaryCard({ 
  icon, 
  label, 
  value, 
  total,
  tooltip,
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: number; 
  total: number;
  tooltip?: string;
}) {
  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
  
  return (
    <div className={`bg-white rounded-lg border border-warm-200 p-4`} title={tooltip}>
      <div className="flex items-center gap-3 mb-2">
        {icon}
        <span className="text-sm font-medium text-gray-600">{label}</span>
      </div>
      <div className="text-2xl font-bold text-gray-800">{value.toLocaleString()}</div>
      <div className="text-xs text-gray-500">{percentage}% of total</div>
    </div>
  );
}

// Priority Card Component
function PriorityCard({
  priority,
  label,
  count,
  color
}: {
  priority: string;
  label: string;
  count: number;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    green: 'bg-green-50 border-green-200 text-green-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
    gray: 'bg-gray-50 border-gray-200 text-gray-700',
  };

  return (
    <div className={`rounded-lg border p-4 ${colorClasses[color]}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="font-bold">{priority}</span>
        <span className="text-2xl font-bold">{count}</span>
      </div>
      <div className="text-xs">{label}</div>
    </div>
  );
}

// Migration Summary Tab Content
function MigrationSummaryTab({ summary }: { summary: MigrationSummaryData }) {
  return (
    <div className="space-y-6">
      {/* Legend & Guide */}
      <MigrationLegend />
      
      {/* Warning banner if present */}
      {summary.warning && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-amber-800">Attention Required</h4>
            <p className="text-sm text-amber-700 mt-1">{summary.warning}</p>
          </div>
        </div>
      )}
      
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Settings Analysis</h3>
        <div className="overflow-hidden rounded-lg border border-warm-200">
          <table className="min-w-full divide-y divide-warm-200">
            <thead className="bg-warm-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Classification</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Count</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-warm-200 bg-white">
              <tr>
                <td className="px-4 py-3 text-sm font-medium text-green-700">MIGRATE</td>
                <td className="px-4 py-3 text-sm text-right font-mono">{summary.migrate.toLocaleString()}</td>
                <td className="px-4 py-3 text-sm text-gray-600">Settings unique to operation - need to be migrated</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm font-medium text-gray-700">DON'T MIGRATE</td>
                <td className="px-4 py-3 text-sm text-right font-mono">{summary.dont_migrate.toLocaleString()}</td>
                <td className="px-4 py-3 text-sm text-gray-600">Settings already in baseline.corp with matching values</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm font-medium text-amber-700">REVIEW</td>
                <td className="px-4 py-3 text-sm text-right font-mono">{summary.review.toLocaleString()}</td>
                <td className="px-4 py-3 text-sm text-gray-600">Settings in both domains with different values</td>
              </tr>
              <tr className="bg-warm-50 font-semibold">
                <td className="px-4 py-3 text-sm">TOTAL</td>
                <td className="px-4 py-3 text-sm text-right font-mono">{summary.total_settings.toLocaleString()}</td>
                <td className="px-4 py-3 text-sm text-gray-600">Total settings analyzed</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-3">GPO Analysis</h3>
        <div className="overflow-hidden rounded-lg border border-warm-200">
          <table className="min-w-full divide-y divide-warm-200">
            <thead className="bg-warm-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Priority</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Count</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-warm-200 bg-white">
              <tr>
                <td className="px-4 py-3 text-sm font-medium text-green-700">P1 - Ready to Migrate</td>
                <td className="px-4 py-3 text-sm text-right font-mono">{summary.p1_count}</td>
                <td className="px-4 py-3 text-sm text-gray-600">GPOs ready for migration (clean or partial overlap)</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm font-medium text-amber-700">P2 - Migrate + Resolve</td>
                <td className="px-4 py-3 text-sm text-right font-mono">{summary.p2_count}</td>
                <td className="px-4 py-3 text-sm text-gray-600">GPOs with migrations but conflicts to resolve first</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm font-medium text-orange-700">P3 - Audit Conflicts</td>
                <td className="px-4 py-3 text-sm text-right font-mono">{summary.p3_count}</td>
                <td className="px-4 py-3 text-sm text-gray-600">GPOs with conflicts only - no unique settings</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm font-medium text-gray-500">P4 - Skip</td>
                <td className="px-4 py-3 text-sm text-right font-mono">{summary.p4_count}</td>
                <td className="px-4 py-3 text-sm text-gray-600">GPOs fully covered by baseline.corp</td>
              </tr>
              <tr className="bg-warm-50 font-semibold">
                <td className="px-4 py-3 text-sm">TOTAL GPOs</td>
                <td className="px-4 py-3 text-sm text-right font-mono">{summary.total_gpos}</td>
                <td className="px-4 py-3 text-sm text-gray-600">Total GPOs analyzed</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Overlap Tooltip Component - shows GPO list on hover
function OverlapTooltip({ items, label, colorClass }: { items: string[]; label: string; colorClass: string }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, flipUp: false });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (items.length === 0) {
    return <span className="text-gray-400">-</span>;
  }

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const flipUp = spaceBelow < 250;
      
      setPosition({
        top: flipUp ? rect.top - 8 : rect.bottom + 8,
        left: Math.min(rect.left, window.innerWidth - 350),
        flipUp
      });
    }
    setShowTooltip(true);
  };
  
  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setShowTooltip(false);
    }, 150);
  };

  return (
    <div 
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        ref={buttonRef}
        className={`text-xs px-2 py-1 rounded ${colorClass} flex items-center gap-1`}
      >
        <span>{items.length} GPO{items.length !== 1 ? 's' : ''}</span>
        <HelpCircle className="h-3 w-3 opacity-60" />
      </button>
      
      {showTooltip && ReactDOM.createPortal(
        <div 
          className="fixed z-[9999] w-80 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl max-h-64 overflow-y-auto"
          style={{ 
            top: position.flipUp ? 'auto' : position.top,
            bottom: position.flipUp ? window.innerHeight - position.top : 'auto',
            left: position.left 
          }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div className="font-semibold text-primary-300 mb-2 pb-2 border-b border-gray-700">
            {label} ({items.length})
          </div>
          <ul className="space-y-1">
            {items.map((item, idx) => (
              <li key={idx} className="text-gray-200">• {item}</li>
            ))}
          </ul>
        </div>,
        document.body
      )}
    </div>
  );
}

// GPO Summary Tab Component
function GPOSummaryTab({ gpoSummary }: { gpoSummary: GPOSummaryRow[] }) {
  const [filterPriority, setFilterPriority] = useState<string>('all');
  
  const filteredData = filterPriority === 'all' 
    ? gpoSummary 
    : gpoSummary.filter(row => row.priority === filterPriority);

  // Check if any row has dn_path (Enterprise-Wide analysis)
  const hasDnPath = gpoSummary.some(row => row.dn_path);
  
  // Check if there are multiple source domains (show Source column)
  const uniqueSources = new Set(gpoSummary.map(row => row.source_domain).filter(Boolean));
  const hasMultipleSources = uniqueSources.size > 1;

  const priorityColors: Record<string, string> = {
    'P1': 'bg-green-100 text-green-800',
    'P2': 'bg-amber-100 text-amber-800',
    'P3': 'bg-orange-100 text-orange-800',
    'P4': 'bg-gray-100 text-gray-800',
  };
  
  // Color coding for source domains
  const getSourceStyle = (source: string) => {
    const sourceLower = source?.toLowerCase() || '';
    if (sourceLower.includes('shared_forest')) {
      return 'bg-purple-100 text-purple-800';
    } else if (sourceLower.includes('enterprise')) {
      return 'bg-blue-100 text-blue-800';
    }
    return 'bg-gray-100 text-gray-700';
  };

  const baseColumns = [
    createColumn<GPOSummaryRow>('priority', 'Priority', {
      cell: (value) => (
        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded ${priorityColors[value as string] || 'bg-gray-100'}`}>
          {value as string}
        </span>
      ),
    }),
    createColumn<GPOSummaryRow>('action', 'Action'),
    createColumn<GPOSummaryRow>('operation_gpo', 'Operation GPO', {
      cell: (value) => (
        <span className="font-medium" title={value as string}>{value as string}</span>
      ),
    }),
  ];

  // Add Source column when there are multiple sources
  const sourceColumn = hasMultipleSources ? [
    createColumn<GPOSummaryRow>('source_domain', 'Source', {
      cell: (value) => {
        const source = value as string;
        if (!source) return <span className="text-gray-400">-</span>;
        return (
          <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${getSourceStyle(source)}`}>
            {source}
          </span>
        );
      },
    }),
  ] : [];

  // Add DN Path column only for Enterprise-Wide (when dn_path is present)
  // Data is pre-formatted by backend using same logic as Domain dashboard's Linked To column
  const dnPathColumn = hasDnPath ? [
    createColumn<GPOSummaryRow>('dn_path', 'Linked To', {
      cell: (value) => {
        const path = value as string;
        if (!path) return <span className="text-gray-400">-</span>;
        
        // Backend formats as "OU1 > OU2 > OU3;" or "[Domain Root: domain.com];"
        // Split on semicolon+newline for multiple links
        const lines = path.split(/;\n|;/).filter(line => line.trim());
        
        return (
          <div className="text-xs text-gray-700 whitespace-pre-line">
            {lines.map((line, i) => (
              <div key={i} className={line.includes('[Domain Root') ? 'text-gray-500 italic' : ''}>
                {line.trim()}
              </div>
            ))}
          </div>
        );
      },
    }),
  ] : [];

  const overlapColumns = [
    createColumn<GPOSummaryRow>('enterprise_standard_overlap', 'Enterprise Overlap', {
      cell: (value) => {
        const items = (value as string)?.split(', ').filter(v => v.trim()) || [];
        return <OverlapTooltip items={items} label="Enterprise Standard GPOs" colorClass="bg-blue-100 text-blue-800" />;
      },
    }),
    createColumn<GPOSummaryRow>('shared_forest_overlap', 'Shared Forest Overlap', {
      cell: (value) => {
        const items = (value as string)?.split(', ').filter(v => v.trim()) || [];
        return <OverlapTooltip items={items} label="Shared Forest Operation GPOs" colorClass="bg-orange-100 text-orange-800" />;
      },
    }),
    createColumn<GPOSummaryRow>('total_settings', 'Settings', {
      cell: (value) => <span className="font-mono">{value as number}</span>,
    }),
    createColumn<GPOSummaryRow>('migrate', 'Migrate', {
      cell: (value) => <span className="font-mono text-green-700">{value as number}</span>,
    }),
    createColumn<GPOSummaryRow>('dont_migrate', "Don't", {
      cell: (value) => <span className="font-mono text-gray-500">{value as number}</span>,
    }),
    createColumn<GPOSummaryRow>('review', 'Review', {
      cell: (value) => <span className="font-mono text-amber-700">{value as number}</span>,
    }),
  ];

  const columns = [...baseColumns, ...sourceColumn, ...dnPathColumn, ...overlapColumns];

  return (
    <div className="space-y-4">
      {/* Legend & Guide */}
      <MigrationLegend />
      
      {/* Priority Filter */}
      <div className="flex items-center gap-4">
        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="px-3 py-2 border border-warm-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="all">All Priorities</option>
          <option value="P1">P1 - Ready to Migrate</option>
          <option value="P2">P2 - Migrate + Resolve</option>
          <option value="P3">P3 - Audit Conflicts</option>
          <option value="P4">P4 - Skip</option>
        </select>
        <span className="text-sm text-gray-500">
          {filterPriority !== 'all' && `Showing ${filteredData.length} of ${gpoSummary.length} GPOs`}
        </span>
      </div>

      {/* DataTable with sorting */}
      <DataTable
        data={filteredData}
        columns={columns}
        pageSize={50}
        searchPlaceholder="Search GPO name, action, overlap..."
      />
    </div>
  );
}

export default MigrationDashboard;
