import { useState, useEffect } from 'react';
import { Download } from 'lucide-react';
import { TabNavigation } from '../components/common/TabNavigation';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { MetricCard, ProgressMetricCard } from '../components/common/MetricCard';
import { DataTable, createColumn } from '../components/common/DataTable';
import {
  getExecutiveDashboard,
  getOperationsSummary,
  getRiskAssessment,
  getBucketComparison,
  downloadExecutiveExcel,
} from '../services/api';
import type {
  MigrationDashboard,
  OperationSummary,
  RiskAssessmentRow,
  BucketComparisonRow,
  TabConfig,
} from '../types';

const EXECUTIVE_TABS: TabConfig[] = [
  { id: 'dashboard', label: '1. Migration Dashboard', shortLabel: 'Dashboard' },
  { id: 'operations', label: '2. Operations Summary', shortLabel: 'Operations' },
  { id: 'risk', label: '3. Risk Assessment', shortLabel: 'Risk' },
  { id: 'buckets', label: '4. Bucket Comparison', shortLabel: 'Buckets' },
];

export function ExecutiveDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [dashboardData, setDashboardData] = useState<MigrationDashboard | null>(null);
  const [operationsData, setOperationsData] = useState<OperationSummary[]>([]);
  const [riskData, setRiskData] = useState<RiskAssessmentRow[]>([]);
  const [bucketData, setBucketData] = useState<BucketComparisonRow[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashboard, operations, risk, buckets] = await Promise.all([
        getExecutiveDashboard(),
        getOperationsSummary(),
        getRiskAssessment(),
        getBucketComparison(),
      ]);
      setDashboardData(dashboard);
      setOperationsData(operations);
      setRiskData(risk);
      setBucketData(buckets);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading executive dashboard..." />;
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 mb-4">{error}</p>
        <button onClick={loadData} className="px-4 py-2 bg-primary-500 text-white rounded hover:bg-primary-600">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <TabNavigation tabs={EXECUTIVE_TABS} activeTab={activeTab} onTabChange={setActiveTab} />
      
      <div className="flex-1 p-6 overflow-auto bg-white">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">
            {EXECUTIVE_TABS.find(t => t.id === activeTab)?.label}
          </h2>
          <button
            onClick={async () => {
              try {
                await downloadExecutiveExcel();
              } catch (err) {
                console.error('Export failed:', err);
                alert('Export failed. Please try again.');
              }
            }}
            className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded hover:bg-primary-600 transition-colors"
          >
            <Download className="h-4 w-4" />
            Export Excel
          </button>
        </div>

        {activeTab === 'dashboard' && dashboardData && (
          <MigrationDashboardTab data={dashboardData} />
        )}
        {activeTab === 'operations' && (
          <OperationsSummaryTab data={operationsData} />
        )}
        {activeTab === 'risk' && (
          <RiskAssessmentTab data={riskData} />
        )}
        {activeTab === 'buckets' && (
          <BucketComparisonTab data={bucketData} />
        )}
      </div>
    </div>
  );
}

// Tab 1: Migration Dashboard
function MigrationDashboardTab({ data }: { data: MigrationDashboard }) {
  return (
    <div className="space-y-6">
      {/* Top Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard value={data.active_gpos} label="Active GPOs" />
        <ProgressMetricCard
          value={`${data.migration_ready_percentage}%`}
          label="Migration Ready"
          total={data.active_gpos}
          current={data.migration_ready}
        />
        <MetricCard value={data.needs_review} label="Needs Review" />
        <MetricCard value={data.dont_migrate} label="Don't Migrate" />
      </div>

      {/* Bucket Distribution */}
      <div className="bg-warm-50 rounded-lg p-6 border border-warm-200">
        <h3 className="text-lg font-semibold mb-4">Bucket Distribution</h3>
        <div className="space-y-3">
          {data.bucket_distribution.map((bucket) => (
            <div key={bucket.bucket} className="flex items-center gap-4">
              <div className="w-32 text-sm font-medium">{bucket.bucket}</div>
              <div className="flex-1 bg-warm-200 rounded-full h-6 overflow-hidden relative">
                <div
                  className="bg-primary-500 h-full flex items-center justify-end pr-2 text-xs text-white font-medium transition-all duration-500"
                  style={{ width: `${Math.max(bucket.percentage, 5)}%` }}
                >
                  {/* Show percentage inside bar if wide enough */}
                  {bucket.percentage >= 12 && (
                    <span>{bucket.percentage.toFixed(1)}%</span>
                  )}
                </div>
                {/* Show percentage outside bar if too narrow */}
                {bucket.percentage < 12 && (
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-600" style={{ left: `${Math.max(bucket.percentage, 5) + 2}%` }}>
                    {bucket.percentage.toFixed(1)}%
                  </span>
                )}
              </div>
              <div className="w-20 text-sm text-right">
                {bucket.count.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4">
        <MetricCard value={data.domains_analyzed} label="Domains Analyzed" />
        <MetricCard value={data.operations_count} label="Operations" />
      </div>
    </div>
  );
}

// Tab 2: Operations Summary
function OperationsSummaryTab({ data }: { data: OperationSummary[] }) {
  const columns = [
    createColumn<OperationSummary>('operation', 'Code'),
    createColumn<OperationSummary>('full_name', 'Operation'),
    createColumn<OperationSummary>('operation_type', 'Type', {
      cell: (value) => (
        <span className={`px-2 py-1 rounded text-xs ${
          value === 'Shared Forest' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
        }`}>
          {String(value)}
        </span>
      ),
    }),
    createColumn<OperationSummary>('total_gpos', 'Total GPOs'),
    createColumn<OperationSummary>('server', 'Server'),
    createColumn<OperationSummary>('workstation', 'Workstation'),
    createColumn<OperationSummary>('user', 'User'),
    createColumn<OperationSummary>('mixed', 'Mixed'),
    createColumn<OperationSummary>('readiness_percentage', 'Readiness', {
      cell: (value) => (
        <span className={`font-medium ${
          Number(value) >= 70 ? 'text-green-600' :
          Number(value) >= 40 ? 'text-yellow-600' : 'text-red-600'
        }`}>
          {String(value)}%
        </span>
      ),
    }),
  ];

  return <DataTable data={data} columns={columns} searchPlaceholder="Search operations..." />;
}

// Tab 3: Risk Assessment
function RiskAssessmentTab({ data }: { data: RiskAssessmentRow[] }) {
  const columns = [
    createColumn<RiskAssessmentRow>('operation', 'Code'),
    createColumn<RiskAssessmentRow>('full_name', 'Operation'),
    createColumn<RiskAssessmentRow>('total_gpos', 'Total GPOs'),
    createColumn<RiskAssessmentRow>('risk_score', 'Risk Score'),
    createColumn<RiskAssessmentRow>('risk_level', 'Risk Level', {
      cell: (value) => (
        <span className={`badge-${String(value).toLowerCase()}`}>
          {String(value)}
        </span>
      ),
    }),
    createColumn<RiskAssessmentRow>('mixed_count', 'Mixed'),
    createColumn<RiskAssessmentRow>('unknown_count', 'Unknown'),
    createColumn<RiskAssessmentRow>('risk_notes', 'Notes', {
      cell: (value) => (
        <span className="text-sm text-gray-600">{String(value)}</span>
      ),
    }),
  ];

  return <DataTable data={data} columns={columns} searchPlaceholder="Search by operation..." />;
}

// Tab 4: Bucket Comparison
function BucketComparisonTab({ data }: { data: BucketComparisonRow[] }) {
  const columns = [
    createColumn<BucketComparisonRow>('operation', 'Code'),
    createColumn<BucketComparisonRow>('full_name', 'Operation'),
    createColumn<BucketComparisonRow>('total_gpos', 'Total'),
    createColumn<BucketComparisonRow>('server_pct', 'Server %', {
      cell: (value) => `${value}%`,
    }),
    createColumn<BucketComparisonRow>('workstation_pct', 'Workstation %', {
      cell: (value) => `${value}%`,
    }),
    createColumn<BucketComparisonRow>('user_pct', 'User %', {
      cell: (value) => `${value}%`,
    }),
    createColumn<BucketComparisonRow>('mixed_pct', 'Mixed %', {
      cell: (value) => `${value}%`,
    }),
    createColumn<BucketComparisonRow>('other_pct', 'Other %', {
      cell: (value) => `${value}%`,
    }),
  ];

  return <DataTable data={data} columns={columns} searchPlaceholder="Search operations..." />;
}
