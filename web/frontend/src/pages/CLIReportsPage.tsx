/**
 * CLI Reports Page
 * 
 * Secure execution of CLI-only reports (Impact, Full).
 * No terminal access - uses dropdown selection only.
 */

import { useState, useEffect } from 'react';
import { AlertTriangle, FileSpreadsheet, Download, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { runImpactReport, runFullReport, getCLIDomains, downloadCLIFile } from '../services/api';

type RunningState = 'impact' | 'full' | 'download' | null;

interface DomainOption {
  value: string;
  label: string;
}

interface CommandResult {
  success: boolean;
  output: string;
  download_url?: string | null;
  filename?: string | null;
  execution_time_seconds?: number | null;
  error?: string | null;
}

export function CLIReportsPage() {
  const [domains, setDomains] = useState<DomainOption[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<string>('');
  const [running, setRunning] = useState<RunningState>(null);
  const [result, setResult] = useState<CommandResult | null>(null);
  const [loadingDomains, setLoadingDomains] = useState(true);

  // Load available domains on mount
  useEffect(() => {
    loadDomains();
  }, []);

  const loadDomains = async () => {
    setLoadingDomains(true);
    try {
      const response = await getCLIDomains();
      const domainList = response.domains || [];
      setDomains(domainList);
      if (domainList.length > 0) {
        setSelectedDomain(domainList[0].value);
      }
    } catch (err) {
      console.error('Failed to load domains:', err);
      setDomains([]);
    } finally {
      setLoadingDomains(false);
    }
  };

  const handleRunImpact = async () => {
    if (!selectedDomain || running) return;
    
    setRunning('impact');
    setResult(null);
    
    try {
      const response = await runImpactReport(selectedDomain);
      setResult(response);
    } catch (err) {
      setResult({
        success: false,
        output: `Error: Failed to run command.\n${err instanceof Error ? err.message : 'Unknown error'}`,
        error: 'Request failed'
      });
    } finally {
      setRunning(null);
    }
  };

  const handleRunFull = async () => {
    if (running) return;
    
    setRunning('full');
    setResult(null);
    
    try {
      const response = await runFullReport();
      setResult(response);
    } catch (err) {
      setResult({
        success: false,
        output: `Error: Failed to run command.\n${err instanceof Error ? err.message : 'Unknown error'}`,
        error: 'Request failed'
      });
    } finally {
      setRunning(null);
    }
  };

  const handleDownload = async () => {
    if (!result?.download_url || !result?.filename || running) return;

    setRunning('download');
    try {
      await downloadCLIFile(result.download_url, result.filename);
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="py-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">CLI Reports</h1>
        <p className="text-gray-600 mt-1">
          Generate reports not available in dashboards
        </p>
      </div>

      {/* Report Cards */}
      <div className="space-y-6">
        
        {/* Impact Analysis Card */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-amber-50 rounded-lg">
                <AlertTriangle className="h-6 w-6 text-amber-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-gray-900">Impact Analysis</h2>
                <p className="text-gray-600 mt-1">
                  Analyze what happens when replacing operation GPOs with enterprise standard equivalents. 
                  Shows settings retained, lost, changed, and added.
                </p>
                
                <div className="mt-4 flex flex-wrap items-end gap-4">
                  <div className="flex-1 min-w-[200px] max-w-sm">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Domain
                    </label>
                    {loadingDomains ? (
                      <div className="flex items-center gap-2 text-gray-500 py-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading domains...
                      </div>
                    ) : domains.length === 0 ? (
                      <div className="text-sm text-red-600 py-2">
                        No domains available. Upload GPOZaurr reports first.
                      </div>
                    ) : (
                      <select
                        value={selectedDomain}
                        onChange={(e) => setSelectedDomain(e.target.value)}
                        disabled={running !== null}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      >
                        {domains.map((domain) => (
                          <option key={domain.value} value={domain.value}>
                            {domain.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  
                  <button
                    onClick={handleRunImpact}
                    disabled={running !== null || !selectedDomain || domains.length === 0}
                    className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                  >
                    {running === 'impact' ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Running...
                      </>
                    ) : (
                      <>
                        <FileSpreadsheet className="h-4 w-4" />
                        Generate Report
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Full Report Card */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <FileSpreadsheet className="h-6 w-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-gray-900">Full Report</h2>
                <p className="text-gray-600 mt-1">
                  Complete 19-tab Excel dump with all GPO data across all domains. 
                  For data analysts needing raw access to the complete dataset.
                </p>
                
                <div className="mt-4">
                  <button
                    onClick={handleRunFull}
                    disabled={running !== null}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                  >
                    {running === 'full' ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Running...
                      </>
                    ) : (
                      <>
                        <FileSpreadsheet className="h-4 w-4" />
                        Generate Report
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Status Message when running */}
        {running && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
              <div>
                <p className="font-medium text-blue-900">
                  {running === 'impact' ? 'Running Impact Analysis...' : 'Running Full Report...'}
                </p>
                <p className="text-sm text-blue-700">
                  This may take a minute. Other reports are disabled until complete.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Output Panel */}
        {result && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="p-4 border-b border-gray-200 flex items-center gap-2">
              {result.success ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              <h3 className="font-medium text-gray-900">
                {result.success ? 'Report Generated' : 'Error'}
              </h3>
              {result.execution_time_seconds && (
                <span className="text-sm text-gray-500 ml-auto">
                  {result.execution_time_seconds.toFixed(1)}s
                </span>
              )}
            </div>
            
            {/* Output text */}
            <div className="p-4 bg-gray-50 max-h-64 overflow-y-auto">
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                {result.output}
              </pre>
            </div>
            
            {/* Download button - uses authenticated request */}
            {result.success && result.download_url && result.filename && (
              <div className="p-4 border-t border-gray-200 bg-green-50">
                <div className="flex items-center gap-3">
                  <Download className="h-5 w-5 text-green-600" />
                  <div>
                    <button
                      onClick={handleDownload}
                      disabled={running === 'download'}
                      className="font-medium text-green-700 hover:text-green-800 hover:underline disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {running === 'download' ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Downloading...
                        </>
                      ) : (
                        result.filename
                      )}
                    </button>
                    <p className="text-sm text-green-600">
                      Available for 60 minutes
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
