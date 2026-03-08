import { useEffect, useState } from 'react';
import { X, AlertTriangle, AlertCircle, Info, Loader2, Copy, Check } from 'lucide-react';
import { getGpoDetails } from '../../services/api';
import type { GPODetails, GPOSetting } from '../../types';

interface GPODetailsPanelProps {
  operationCode: string;
  gpoName: string | null;
  onClose: () => void;
}

export function GPODetailsPanel({ operationCode, gpoName, onClose }: GPODetailsPanelProps) {
  const [details, setDetails] = useState<GPODetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedSetting, setCopiedSetting] = useState<string | null>(null);

  useEffect(() => {
    if (gpoName) {
      loadDetails();
    }
  }, [gpoName, operationCode]);

  const loadDetails = async () => {
    if (!gpoName) return;
    
    setLoading(true);
    setError(null);
    try {
      const data = await getGpoDetails(operationCode, gpoName);
      setDetails(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load GPO details');
      setDetails(null);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSetting(id);
      setTimeout(() => setCopiedSetting(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Don't render if no GPO selected
  if (!gpoName) return null;

  const severityIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const severityBg = (severity: string) => {
    switch (severity) {
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'warning':
        return 'bg-amber-50 border-amber-200';
      default:
        return 'bg-blue-50 border-blue-200';
    }
  };

  const readinessColor = (readiness: string) => {
    switch (readiness) {
      case 'Ready':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'Review First':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'Consider Splitting':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'Not Applicable':
        return 'bg-gray-100 text-gray-600 border-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  // Group settings by category
  const groupedSettings = details?.settings.reduce((acc, setting) => {
    const category = setting.category || 'Uncategorized';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(setting);
    return acc;
  }, {} as Record<string, GPOSetting[]>) || {};

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
      />
      
      {/* Side Panel */}
      <div className="fixed right-0 top-0 h-full w-[500px] max-w-[90vw] bg-white shadow-2xl z-50 flex flex-col animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-primary-50">
          <div className="flex-1 min-w-0 pr-4">
            <h2 className="text-lg font-semibold text-primary-900 truncate" title={gpoName}>
              {gpoName}
            </h2>
            {details && (
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xs px-2 py-0.5 rounded border ${readinessColor(details.readiness)}`}>
                  {details.readiness}
                </span>
                <span className="text-xs text-gray-500">
                  {details.bucket}
                </span>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-primary-100 rounded-full transition-colors"
            aria-label="Close panel"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
              <span className="ml-2 text-gray-600">Loading details...</span>
            </div>
          )}

          {error && (
            <div className="p-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                <AlertCircle className="h-5 w-5 inline mr-2" />
                {error}
              </div>
            </div>
          )}

          {details && !loading && (
            <div className="p-4 space-y-6">
              {/* Issues Section */}
              {details.issues.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Issues & Warnings ({details.issues.length})
                  </h3>
                  <div className="space-y-2">
                    {details.issues.map((issue, idx) => (
                      <div 
                        key={idx}
                        className={`p-3 rounded-lg border ${severityBg(issue.severity)}`}
                      >
                        <div className="flex items-start gap-2">
                          {severityIcon(issue.severity)}
                          <div className="flex-1">
                            <div className="font-medium text-sm">{issue.message}</div>
                            {issue.detail && (
                              <div className="text-xs text-gray-600 mt-1">{issue.detail}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* GPO Info Section */}
              <section>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">GPO Information</h3>
                <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Applies To:</span>
                    <span className="font-medium">{details.applies_to}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Match Type:</span>
                    <span className="font-medium">{details.match_type}</span>
                  </div>
                  {details.guid && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">GUID:</span>
                      <span className="font-mono text-xs">{details.guid}</span>
                    </div>
                  )}
                  {details.created && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Created:</span>
                      <span>{details.created}</span>
                    </div>
                  )}
                  {details.last_modified && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Modified:</span>
                      <span>{details.last_modified}</span>
                    </div>
                  )}
                </div>
              </section>

              {/* Link Locations */}
              {details.link_locations.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">
                    Link Locations ({details.link_locations.length})
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-3 space-y-1 max-h-40 overflow-y-auto">
                    {details.link_locations.map((link, idx) => (
                      <div key={idx} className="text-xs font-mono text-gray-700 break-all">
                        {link}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Settings Section */}
              <section>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  Settings ({details.settings_count})
                </h3>
                
                {details.settings_count === 0 ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-yellow-700 text-sm">
                    <AlertTriangle className="h-4 w-4 inline mr-2" />
                    No settings found for this GPO. It may be empty or settings weren't extracted from the report.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(groupedSettings).map(([category, settings]) => (
                      <div key={category} className="border border-gray-200 rounded-lg overflow-hidden">
                        <div className="bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 border-b border-gray-200">
                          {category} ({settings.length})
                        </div>
                        <div className="divide-y divide-gray-100">
                          {settings.map((setting, idx) => (
                            <div 
                              key={idx}
                              className="px-3 py-2 hover:bg-gray-50 group"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-gray-800 break-words">
                                    {setting.setting_name}
                                  </div>
                                  <div className="text-xs text-gray-600 mt-1 break-all font-mono bg-gray-50 p-1 rounded">
                                    {setting.setting_value || '(empty)'}
                                  </div>
                                </div>
                                <button
                                  onClick={() => copyToClipboard(
                                    `${setting.setting_name}: ${setting.setting_value}`,
                                    `${category}-${idx}`
                                  )}
                                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded transition-all"
                                  title="Copy setting"
                                >
                                  {copiedSetting === `${category}-${idx}` ? (
                                    <Check className="h-4 w-4 text-green-500" />
                                  ) : (
                                    <Copy className="h-4 w-4 text-gray-400" />
                                  )}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Detection Reason */}
              {details.detection_reason && (
                <section>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Detection Reason</h3>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                    {details.detection_reason}
                  </div>
                </section>
              )}

              {/* Action */}
              {details.action && (
                <section>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Recommended Action</h3>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                    {details.action}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {details && !loading && (
          <div className="border-t border-gray-200 p-4 bg-gray-50">
            <div className="text-xs text-gray-500 text-center">
              Click outside panel or press Escape to close
            </div>
          </div>
        )}
      </div>
    </>
  );
}
