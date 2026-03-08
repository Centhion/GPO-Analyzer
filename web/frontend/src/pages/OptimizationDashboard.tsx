import { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Download, Info, ChevronDown, ChevronUp, HelpCircle, FileSpreadsheet } from 'lucide-react';
import { TabNavigation } from '../components/common/TabNavigation';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { MetricCard } from '../components/common/MetricCard';
import { DataTable, createColumn } from '../components/common/DataTable';
import { GPODetailsPanel } from '../components/common/GPODetailsPanel';
import {
  getAvailableOperations,
  getDomainOverview,
  getServerGpos,
  getWorkstationGpos,
  getUserGpos,
  getReviewRequired,
  downloadDomainExcel,
} from '../services/api';
import type {
  AvailableOperation,
  DomainBucketOverview,
  GPORow,
  PaginatedResponse,
  TabConfig,
} from '../types';

// ============================================================================
// Legend/Key Component - Compact Design
// ============================================================================

const LEGENDS: Record<string, { columns: string[]; notes?: string[]; keywords?: string }> = {
  server: {
    columns: [
      'GPO Name = Policy name',
      'Linked To = OU path(s) where GPO is linked',
      'Applies To = What settings the GPO contains (Computer/User/Both)',
      'Settings = Number of configured settings',
      'Readiness = Ready (migrate), Review First (check first)',
    ],
    notes: [
      '📍 Bucket = WHERE the GPO is linked (the OU type)',
      '⚙️ Applies To = WHAT settings the GPO contains',
      '✅ Server Bucket + "Both" is valid: Computer settings apply to servers, User settings apply to users who log in.',
    ],
    keywords: 'Server, Servers',
  },
  workstation: {
    columns: [
      'GPO Name = Policy name',
      'Linked To = OU path(s) where GPO is linked',
      'Applies To = What settings the GPO contains (Computer/User/Both)',
      'Settings = Number of configured settings',
      'Readiness = Ready (migrate), Review First (check first)',
    ],
    notes: [
      '📍 Bucket = WHERE the GPO is linked (the OU type)',
      '⚙️ Applies To = WHAT settings the GPO contains',
      '✅ Workstation Bucket + "Both" is valid: Computer settings apply to workstations, User settings apply via loopback processing.',
    ],
    keywords: 'Computer(s), Workstation(s), Desktop(s), Laptop(s), PC(s), Client(s), Tablet(s), Kiosk(s), POS, Terminal(s), VDI, Thin Client',
  },
  user: {
    columns: [
      'GPO Name = Policy name',
      'Linked To = OU path(s) where GPO is linked',
      'Applies To = What settings the GPO contains (Computer/User/Both)',
      'Optimization Note = Consolidation recommendation',
    ],
    notes: [
      '📍 Bucket = WHERE the GPO is linked (User OU)',
      '⚙️ Applies To = WHAT settings the GPO contains',
      '⚠️ User Bucket + "Both" is INEFFICIENT: Computer settings have NO EFFECT on user objects!',
      '⚠️ User Bucket + "Computer" is WASTED: 100% of settings do nothing in a User OU.',
      '💡 If consolidating, prefer Workstation GPOs (machine-based, easier to manage).',
    ],
    keywords: 'User(s), People',
  },
  review: {
    columns: [
      'GPO Name = Policy name',
      'Bucket = OU type classification',
      'Match Type = How identified (Name Match vs Links Only)',
      'Action = Recommended next step',
      'Detection Reason = Why bucket was assigned (explains Unknown/Mixed)',
    ],
    notes: [
      '📋 WHY GPOs END UP HERE:',
      '• Unknown = Linked to OUs without recognized keywords - needs manual classification',
      '• Mixed = Linked to multiple OU types - often intentional, needs verification',
      '• Domain Root = Linked at domain level (DC=) - applies to entire domain',
      '• Domain Controller = Linked to Domain Controllers OU - infrastructure policy',
      '',
      '🎯 MIXED GPO GUIDANCE (Best Practice):',
      '• Mixed is NOT automatically wrong - security baselines SHOULD apply broadly',
      '• Ask: "Are ALL settings appropriate for ALL target types?"',
      '• KEEP multi-target if: security baseline, audit policy, certificates, time/network settings',
      '• SPLIT if: role-specific hardening, power settings, user experience, app deployment',
      '• Avoid GPO sprawl - more GPOs = slower logon + more maintenance',
      '',
      '🎯 OTHER ACTIONS:',
      '• DON\'T MIGRATE = Infrastructure GPOs - recreate in target based on standards',
      '• Unknown = Classify the OU type, then reassess',
    ],
    keywords: 'Detection keywords: Server(s), Computer(s), Workstation(s), Desktop(s), Laptop(s), Client(s), User(s), Domain Controllers, POS, VDI, Kiosk(s)',
  },
};

function Legend({ tabType }: { tabType: 'server' | 'workstation' | 'user' | 'review' }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const legend = LEGENDS[tabType] || LEGENDS.server;

  return (
    <div className="mb-4 bg-warm-50 border border-warm-200 rounded-lg">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-2 text-left hover:bg-warm-100 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-2 text-gray-700">
          <Info className="h-4 w-4 text-primary-500" />
          <span className="font-medium text-sm">Legend & Tips</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-gray-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-500" />
        )}
      </button>
      
      {isExpanded && (
        <div className="px-4 pb-3 border-t border-warm-200">
          {/* Columns in a compact grid */}
          <div className="flex flex-wrap gap-x-6 gap-y-1 mt-2 text-xs text-gray-600">
            {legend.columns.map((col, idx) => (
              <span key={idx}><strong>{col.split('=')[0]}</strong>={col.split('=')[1]}</span>
            ))}
          </div>
          
          {/* Keywords if present */}
          {legend.keywords && (
            <div className="mt-2 text-xs">
              <span className="text-gray-500">🔍 </span>
              <span className="text-gray-600 italic">{legend.keywords}</span>
            </div>
          )}
          
          {/* Notes if present */}
          {legend.notes && (
            <div className="mt-3 pt-2 border-t border-warm-200 space-y-1">
              {legend.notes.map((note, idx) => (
                <p key={idx} className={`text-xs ${note === '' ? 'h-2' : 'text-gray-700'}`}>{note}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Tooltip Component for Action Items
// ============================================================================

const ACTION_TOOLTIPS: Record<string, { title: string; why: string; steps: string[] }> = {
  "DON'T MIGRATE: Linked at domain root": {
    title: 'Domain Root GPO',
    why: 'Domain Root GPOs apply to ALL objects in the domain. They contain domain-wide policies like password requirements.',
    steps: [
      'Do NOT copy - will conflict with target domain policies',
      'Document current settings',
      'Compare with enterprise standards in target domain',
      'Work with AD team to implement equivalent settings',
    ],
  },
  "DON'T MIGRATE: Domain Controller": {
    title: 'Domain Controller GPO',
    why: 'DC GPOs are tightly coupled to source domain infrastructure. Each domain has its own DC requirements.',
    steps: [
      'Do NOT migrate directly',
      'Review: audit policies, security hardening, replication settings',
      'Coordinate with AD team for target DC standards',
    ],
  },
  "VERIFY: Applies to both Servers and Workstations": {
    title: 'Multi-Target GPO (May Be Intentional)',
    why: 'This GPO applies to both Servers and Workstations. This is often correct for security baselines and infrastructure settings.',
    steps: [
      'Review: Are ALL settings appropriate for BOTH servers and workstations?',
      'If YES: Keep as-is - broad security policies are valid',
      'If NO: Split into Server and Workstation GPOs',
      'Examples to KEEP: security baselines, audit policies, certificates',
      'Examples to SPLIT: power settings, user experience, role-specific hardening',
    ],
  },
  "VERIFY: Multi-target GPO": {
    title: 'Multi-Target GPO',
    why: 'This GPO links to multiple OU types. Verify if this is intentional broad policy or should be split.',
    steps: [
      'Review what settings are in this GPO',
      'Determine if settings apply universally or are role-specific',
      'If universal (security, audit, certs): Keep as multi-target',
      'If role-specific: Split into separate GPOs per target type',
    ],
  },
  "REVIEW: Mixed targeting": {
    title: 'Mixed with Unknown OUs',
    why: 'This GPO links to OUs we couldn\'t classify. Need to identify the Unknown OUs first.',
    steps: [
      'Check Detection Reason to see which OUs are Unknown',
      'Classify those OUs as Server, Workstation, or User',
      'Then reassess if GPO needs splitting',
    ],
  },
  "REVIEW: Mixed User + Computer": {
    title: 'Mixed User + Computer Targeting (Unusual)',
    why: 'User settings don\'t apply to computer objects and vice versa. This combination is typically a configuration error.',
    steps: [
      'Review the GPO settings',
      'Computer settings should link to Computer/Server/Workstation OUs',
      'User settings should link to User OUs',
      'Split into separate GPOs if both types of settings exist',
    ],
  },
  "REVIEW: Includes Domain Controllers": {
    title: 'Includes Domain Controllers (Sensitive)',
    why: 'Domain Controllers require special handling. Verify this GPO should apply to DCs.',
    steps: [
      'DCs are critical infrastructure - changes can impact entire domain',
      'Verify settings are DC-appropriate',
      'Consider if DC settings should be in dedicated DC GPO',
      'Coordinate with AD team before any changes',
    ],
  },
  "REVIEW: Unable to classify": {
    title: 'Unknown Bucket',
    why: 'The OU structure doesn\'t match known patterns (Server/Workstation/User/DC). Manual inspection needed.',
    steps: [
      'Check Detection Reason for the unrecognized OU names',
      'Determine what objects are in those OUs',
      'Classify as Server, Workstation, User, or other',
      'Document decision for future reference',
    ],
  },
  "REVIEW: GPO linked to operation OU": {
    title: 'Links-Only Detection - Verify Ownership',
    why: 'GPO linked to your operation\'s OU but name doesn\'t contain operation code. Could be shared or misconfigured.',
    steps: [
      'Check if GPO is used by other operations',
      'Verify this GPO belongs to your operation',
      'If shared, coordinate before migrating',
      'Consider renaming to include operation code',
    ],
  },
};

function ActionTooltip({ action }: { action: string }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, flipUp: false });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const tooltipKey = Object.keys(ACTION_TOOLTIPS).find(key => action.includes(key));
  const tooltip = tooltipKey ? ACTION_TOOLTIPS[tooltipKey] : null;
  
  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    // Calculate position relative to viewport
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const flipUp = spaceBelow < 320; // Flip if less than 320px below
      
      setPosition({
        top: flipUp ? rect.top - 8 : rect.bottom + 8,
        left: Math.min(rect.left, window.innerWidth - 400), // Keep within viewport
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
  
  // Use distinct background colors for different action types
  let badgeClass = 'bg-gray-100 text-gray-800';
  if (action.includes("DON'T MIGRATE")) {
    badgeClass = 'bg-red-100 text-red-800 border border-red-300';
  } else if (action.includes('REVIEW:') || action.includes('MANUAL REVIEW')) {
    badgeClass = 'bg-amber-100 text-amber-800 border border-amber-300';
  } else if (action.includes('VERIFY:')) {
    badgeClass = 'bg-blue-100 text-blue-800 border border-blue-300';
  } else if (action.includes('Links Only')) {
    badgeClass = 'bg-yellow-100 text-yellow-800 border border-yellow-300';
  }
  
  // Truncate for display - full text always in tooltip
  const displayText = action.length > 70 ? action.substring(0, 70) + '...' : action;
  
  return (
    <div 
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        ref={buttonRef}
        className={`text-xs px-2 py-1 rounded ${badgeClass} flex items-center gap-1 text-left max-w-md`}
      >
        <span className="line-clamp-2">{displayText}</span>
        <HelpCircle className="h-3 w-3 flex-shrink-0 opacity-60" />
      </button>
      
      {showTooltip && ReactDOM.createPortal(
        <div 
          className="fixed z-[9999] w-96 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl max-h-80 overflow-y-auto"
          style={{ 
            top: position.flipUp ? 'auto' : position.top,
            bottom: position.flipUp ? window.innerHeight - position.top : 'auto',
            left: position.left 
          }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {/* Always show full action text first */}
          <div className="font-semibold text-primary-300 mb-2 pb-2 border-b border-gray-700">
            Full Action:
          </div>
          <p className="text-gray-100 mb-3 leading-relaxed">{action}</p>
          
          {/* Show guidance if we have a matching tooltip */}
          {tooltip && (
            <>
              <div className="font-semibold text-amber-300 mb-1 pt-2 border-t border-gray-700">
                {tooltip.title}
              </div>
              <p className="text-gray-300 mb-2">{tooltip.why}</p>
              <div className="font-medium mb-1">Recommended Steps:</div>
              <ul className="space-y-0.5 text-gray-200">
                {tooltip.steps.map((step, idx) => (
                  <li key={idx}>• {step}</li>
                ))}
              </ul>
            </>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

// ============================================================================
// Optimization Tooltip for User GPO tab
// ============================================================================

function OptimizationTooltip({ note, appliesTo }: { note: string; appliesTo: string }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, flipUp: false });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
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
        left: Math.min(rect.left, window.innerWidth - 300),
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
  
  let recommendation = '';
  let reason = '';
  
  if (appliesTo === 'Computer') {
    recommendation = 'Move to Workstation bucket';
    reason = 'This GPO only configures computer settings but is linked to a User OU. Moving to Workstation bucket ensures settings apply based on machine, not user location.';
  } else if (appliesTo === 'Both') {
    recommendation = 'Consider splitting this GPO';
    reason = 'This GPO has both computer and user settings. Split into: (1) Workstation GPO for computer settings, (2) User GPO for user-specific settings. This enables cleaner migration.';
  } else {
    recommendation = 'Review for consolidation';
    reason = 'Workstation-based policies are preferred because they\'re easier to manage, more predictable (tied to machine), and simpler to migrate.';
  }
  
  return (
    <div 
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        ref={buttonRef}
        className="text-sm text-amber-700 italic flex items-center gap-1 text-left"
      >
        {note}
        <HelpCircle className="h-3 w-3 text-amber-500 flex-shrink-0" />
      </button>
      
      {showTooltip && ReactDOM.createPortal(
        <div 
          className="fixed z-[9999] w-72 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl max-h-64 overflow-y-auto"
          style={{ 
            top: position.flipUp ? 'auto' : position.top,
            bottom: position.flipUp ? window.innerHeight - position.top : 'auto',
            left: position.left 
          }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div className="font-semibold text-amber-300 mb-1">{recommendation}</div>
          <p className="text-gray-300 mb-2">{reason}</p>
          <div className="text-primary-300 font-medium">
            Why Workstation over User?
          </div>
          <ul className="space-y-0.5 text-gray-200 mt-1">
            <li>• Machine-based = easier to manage</li>
            <li>• Settings stay with the computer</li>
            <li>• Better for security (lock the endpoint)</li>
            <li>• Simpler migration path</li>
          </ul>
        </div>,
        document.body
      )}
    </div>
  );
}

// ============================================================================
// Applies To Tooltip - explains what settings the GPO contains
// ============================================================================

function AppliesToTooltip({ appliesTo }: { appliesTo: string }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, flipUp: false });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
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
        left: Math.min(rect.left, window.innerWidth - 300),
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
  
  const colorClass = 
    appliesTo === 'Computer' ? 'bg-blue-100 text-blue-800' :
    appliesTo === 'User' ? 'bg-purple-100 text-purple-800' :
    appliesTo === 'Both' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800';
  
  const tooltipContent = {
    'Computer': {
      title: 'Computer Configuration Only',
      description: 'This GPO contains only Computer Configuration settings.',
      examples: ['Security policies', 'Software installation (machine)', 'Windows Update settings', 'Power management', 'Audit policies'],
      note: 'These settings apply when the computer starts up, regardless of who logs in.'
    },
    'User': {
      title: 'User Configuration Only', 
      description: 'This GPO contains only User Configuration settings.',
      examples: ['Desktop/Start menu settings', 'Folder redirection', 'Software installation (user)', 'Drive mappings', 'Printer connections'],
      note: 'These settings apply when a user logs in, following them to any computer.'
    },
    'Both': {
      title: 'Computer + User Configuration',
      description: 'This GPO contains both Computer and User Configuration settings.',
      examples: ['Mixed security + personalization', 'Computer hardening + user restrictions', 'Machine settings + logon scripts'],
      note: 'Consider splitting into separate GPOs for cleaner management and migration.'
    },
    'Unknown': {
      title: 'Configuration Unknown',
      description: 'Unable to determine the configuration type.',
      examples: [],
      note: 'Check GPO in GPMC for details.'
    }
  };
  
  const content = tooltipContent[appliesTo as keyof typeof tooltipContent] || tooltipContent['Unknown'];
  
  return (
    <div 
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        ref={buttonRef}
        className={`px-2 py-1 rounded text-xs ${colorClass} flex items-center gap-1`}
      >
        {appliesTo}
        <HelpCircle className="h-3 w-3 opacity-60" />
      </button>
      
      {showTooltip && ReactDOM.createPortal(
        <div 
          className="fixed z-[9999] w-72 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl max-h-64 overflow-y-auto"
          style={{ 
            top: position.flipUp ? 'auto' : position.top,
            bottom: position.flipUp ? window.innerHeight - position.top : 'auto',
            left: position.left 
          }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div className="font-semibold text-primary-300 mb-1">{content.title}</div>
          <p className="text-gray-300 mb-2">{content.description}</p>
          {content.examples.length > 0 && (
            <>
              <div className="font-medium text-gray-200 mb-1">Common settings:</div>
              <ul className="space-y-0.5 text-gray-300 mb-2">
                {content.examples.slice(0, 4).map((ex, idx) => (
                  <li key={idx}>• {ex}</li>
                ))}
              </ul>
            </>
          )}
          <p className="text-gray-400 italic border-t border-gray-700 pt-2 mt-2">{content.note}</p>
        </div>,
        document.body
      )}
    </div>
  );
}

// ============================================================================
// Readiness Tooltip - explains migration readiness status
// ============================================================================

function ReadinessTooltip({ readiness }: { readiness: string }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, flipUp: false });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const flipUp = spaceBelow < 200;
      setPosition({
        top: flipUp ? rect.top - 8 : rect.bottom + 8,
        left: Math.min(rect.left, window.innerWidth - 300),
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
  
  let colorClass = 'bg-gray-100 text-gray-800';
  if (readiness === 'Ready') colorClass = 'bg-green-100 text-green-800';
  else if (readiness === 'Review First') colorClass = 'bg-amber-100 text-amber-800';
  else if (readiness === 'Consider Splitting') colorClass = 'bg-yellow-100 text-yellow-800';
  else if (readiness === 'Not Applicable') colorClass = 'bg-gray-200 text-gray-600';
  
  const tooltipContent = {
    'Ready': {
      title: 'Ready to Migrate',
      description: 'This GPO is properly configured and can be migrated as-is.',
      guidance: 'Proceed with migration following standard procedures.',
    },
    'Review First': {
      title: 'Review Before Migration',
      description: 'This GPO needs manual inspection before migration.',
      guidance: 'Check the Action column for specific guidance on what to verify.',
    },
    'Consider Splitting': {
      title: 'Consider Splitting',
      description: 'This GPO works but could be optimized by splitting into separate policies.',
      guidance: 'Review Optimization Note for details. Splitting is optional but recommended for cleaner management.',
    },
    'Not Applicable': {
      title: 'Not Applicable for Migration',
      description: 'This GPO should not be migrated directly (Domain Root or DC policies).',
      guidance: 'Work with AD team to implement equivalent settings in the target domain.',
    },
  };
  
  const content = tooltipContent[readiness as keyof typeof tooltipContent] || {
    title: readiness,
    description: 'Unknown readiness status.',
    guidance: 'Manual review recommended.',
  };
  
  return (
    <div 
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        ref={buttonRef}
        className={`px-2 py-1 rounded text-xs ${colorClass} flex items-center gap-1`}
      >
        {readiness}
        <HelpCircle className="h-3 w-3 opacity-60" />
      </button>
      
      {showTooltip && ReactDOM.createPortal(
        <div 
          className="fixed z-[9999] w-72 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl"
          style={{ 
            top: position.flipUp ? 'auto' : position.top,
            bottom: position.flipUp ? window.innerHeight - position.top : 'auto',
            left: position.left 
          }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div className="font-semibold text-primary-300 mb-1">{content.title}</div>
          <p className="text-gray-300 mb-2">{content.description}</p>
          <p className="text-gray-400 italic border-t border-gray-700 pt-2 mt-2">{content.guidance}</p>
        </div>,
        document.body
      )}
    </div>
  );
}

const DOMAIN_TABS: TabConfig[] = [
  { id: 'overview', label: '1. Bucket Overview', shortLabel: 'Overview' },
  { id: 'server', label: '2. Server GPOs', shortLabel: 'Server' },
  { id: 'workstation', label: '3. Workstation GPOs', shortLabel: 'Workstation' },
  { id: 'user', label: '4. User GPOs', shortLabel: 'User' },
  { id: 'review', label: '5. Review Required', shortLabel: 'Review' },
];

export function OptimizationDashboard() {
  // Operation selection state (in-page, like Migration)
  const [operations, setOperations] = useState<AvailableOperation[]>([]);
  const [selectedOperation, setSelectedOperation] = useState<AvailableOperation | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loadingOperations, setLoadingOperations] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  
  const [activeTab, setActiveTab] = useState('overview');
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [overviewData, setOverviewData] = useState<DomainBucketOverview | null>(null);
  const [serverGpos, setServerGpos] = useState<PaginatedResponse<GPORow> | null>(null);
  const [workstationGpos, setWorkstationGpos] = useState<PaginatedResponse<GPORow> | null>(null);
  const [userGpos, setUserGpos] = useState<PaginatedResponse<GPORow> | null>(null);
  const [reviewGpos, setReviewGpos] = useState<PaginatedResponse<GPORow> | null>(null);

  // Pagination states
  const [serverPage, setServerPage] = useState(1);
  const [workstationPage, setWorkstationPage] = useState(1);
  const [userPage, setUserPage] = useState(1);
  const [reviewPage, setReviewPage] = useState(1);

  // Side panel state for GPO details drill-down
  const [selectedGpo, setSelectedGpo] = useState<string | null>(null);

  // Handle Escape key to close panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedGpo) {
        setSelectedGpo(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedGpo]);

  // Load operations list on mount
  useEffect(() => {
    loadOperations();
  }, []);

  // Load tab data when tab changes (only if we have data)
  useEffect(() => {
    if (!overviewData || !selectedOperation) return;
    
    if (activeTab === 'server') loadServerGpos();
    else if (activeTab === 'workstation') loadWorkstationGpos();
    else if (activeTab === 'user') loadUserGpos();
    else if (activeTab === 'review') loadReviewGpos();
  }, [activeTab, selectedOperation?.code, serverPage, workstationPage, userPage, reviewPage]);

  const loadOperations = async () => {
    try {
      setLoadingOperations(true);
      const data = await getAvailableOperations();
      const sorted = [...data.operations].sort((a, b) => a.full_name.localeCompare(b.full_name));
      setOperations(sorted);
    } catch (err) {
      console.error('Failed to load operations:', err);
      setError('Failed to load operations list');
    } finally {
      setLoadingOperations(false);
    }
  };

  const runAnalysis = async () => {
    if (!selectedOperation) return;
    
    setAnalyzing(true);
    setError(null);
    setActiveTab('overview');
    
    // Reset all data
    setOverviewData(null);
    setServerGpos(null);
    setWorkstationGpos(null);
    setUserGpos(null);
    setReviewGpos(null);
    
    await loadOverview();
    setAnalyzing(false);
  };

  const loadOverview = async () => {
    if (!selectedOperation) return;
    
    setError(null);
    try {
      const overview = await getDomainOverview(selectedOperation.code);
      setOverviewData(overview);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    }
  };

  const loadServerGpos = async () => {
    if (!selectedOperation) return;
    try {
      const data = await getServerGpos(selectedOperation.code, serverPage);
      setServerGpos(data);
    } catch (err) {
      console.error('Failed to load server GPOs:', err);
    }
  };

  const loadWorkstationGpos = async () => {
    if (!selectedOperation) return;
    try {
      const data = await getWorkstationGpos(selectedOperation.code, workstationPage);
      setWorkstationGpos(data);
    } catch (err) {
      console.error('Failed to load workstation GPOs:', err);
    }
  };

  const loadUserGpos = async () => {
    if (!selectedOperation) return;
    try {
      const data = await getUserGpos(selectedOperation.code, userPage);
      setUserGpos(data);
    } catch (err) {
      console.error('Failed to load user GPOs:', err);
    }
  };

  const loadReviewGpos = async () => {
    if (!selectedOperation) return;
    try {
      const data = await getReviewRequired(selectedOperation.code, reviewPage);
      setReviewGpos(data);
    } catch (err) {
      console.error('Failed to load review GPOs:', err);
    }
  };

  const handleExport = async () => {
    if (!selectedOperation) return;
    try {
      setError(null);
      await downloadDomainExcel(selectedOperation.code);
    } catch (err: any) {
      const errorMsg = err?.response?.data?.detail || err?.message || 'Export failed';
      setError(errorMsg);
      console.error('Export error:', err);
    }
  };

  // Loading operations list
  if (loadingOperations) {
    return <LoadingSpinner message="Loading operations..." />;
  }

  return (
    <div className="py-6">
      {/* Header with Synopsis */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Optimization Mode</h1>
        <p className="text-gray-600 mb-3">
          Operation-specific GPO analysis and bucket optimization
        </p>
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
          <strong>📊 What this shows:</strong> Displays operation-specific GPOs only (excludes enterprise standard policies). 
          Use for bucket analysis, migration readiness assessment, and GPO inventory. 
          GPO counts shown are <strong>non-enterprise-standard</strong> policies for this operation.
        </div>
      </div>

      {/* Operation Selection & Actions */}
      <div className="bg-white rounded-lg shadow-sm border border-warm-200 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          {/* Operation Dropdown */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Operation
            </label>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-warm-300 rounded-lg hover:bg-warm-50 min-w-[280px] justify-between"
            >
              <span>
                {selectedOperation ? (
                  <>
                    <span className="font-medium">{selectedOperation.code}</span>
                    <span className="text-gray-500 text-sm ml-2">
                      {selectedOperation.full_name} ({selectedOperation.gpo_count} GPOs)
                    </span>
                  </>
                ) : (
                  'Select operation...'
                )}
              </span>
              <ChevronDown className={`h-4 w-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {dropdownOpen && (
              <div className="absolute top-full left-0 mt-1 w-full bg-white rounded-lg shadow-lg border border-warm-200 py-2 z-50 max-h-64 overflow-auto">
                {operations.map((op) => (
                  <button
                    key={op.code}
                    onClick={() => {
                      setSelectedOperation(op);
                      setDropdownOpen(false);
                      // Reset data when changing operations
                      setOverviewData(null);
                      setServerGpos(null);
                      setWorkstationGpos(null);
                      setUserGpos(null);
                      setReviewGpos(null);
                    }}
                    className={`block w-full text-left px-4 py-2 hover:bg-warm-100 ${
                      selectedOperation?.code === op.code ? 'bg-primary-50 text-primary-700' : ''
                    }`}
                  >
                    <div className="font-medium">{op.code}</div>
                    <div className="text-xs text-gray-500">
                      {op.full_name} • {op.gpo_count} GPOs (non-enterprise-standard)
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
              disabled={!selectedOperation || analyzing}
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
              disabled={!selectedOperation}
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
        <div
          className="fixed inset-0 z-40"
          onClick={() => setDropdownOpen(false)}
        />
      )}

      {/* Analyzing state */}
      {analyzing && (
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner message={`Analyzing ${selectedOperation?.full_name}...`} />
        </div>
      )}

      {/* Results */}
      {overviewData && !analyzing && (
        <>
          <TabNavigation tabs={DOMAIN_TABS} activeTab={activeTab} onTabChange={setActiveTab} />
          
          <div className="bg-white rounded-lg shadow-sm border border-warm-200 p-6 mt-4">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-800">{selectedOperation?.full_name}</h2>
                <p className="text-sm text-gray-500">
                  {DOMAIN_TABS.find(t => t.id === activeTab)?.label}
                </p>
              </div>
            </div>

            {activeTab === 'overview' && overviewData && (
              <BucketOverviewTab data={overviewData} />
            )}
            {activeTab === 'server' && serverGpos && (
              <GPOListTab 
                data={serverGpos} 
                page={serverPage} 
                onPageChange={setServerPage}
                emptyMessage="No Server GPOs found for this operation"
                tabType="server"
                onRowClick={setSelectedGpo}
                selectedGpo={selectedGpo}
              />
            )}
            {activeTab === 'workstation' && workstationGpos && (
              <GPOListTab 
                data={workstationGpos} 
                page={workstationPage} 
                onPageChange={setWorkstationPage}
                emptyMessage="No Workstation GPOs found for this operation"
                tabType="workstation"
                onRowClick={setSelectedGpo}
                selectedGpo={selectedGpo}
              />
            )}
            {activeTab === 'user' && userGpos && (
              <GPOListTab 
                data={userGpos} 
                page={userPage} 
                onPageChange={setUserPage}
                emptyMessage="No User GPOs found for this operation"
                tabType="user"
                onRowClick={setSelectedGpo}
                selectedGpo={selectedGpo}
              />
            )}
            {activeTab === 'review' && reviewGpos && (
              <GPOListTab 
                data={reviewGpos} 
                page={reviewPage} 
                onPageChange={setReviewPage}
                emptyMessage="No GPOs requiring review - great job!"
                tabType="review"
                onRowClick={setSelectedGpo}
                selectedGpo={selectedGpo}
              />
            )}
          </div>

          {/* GPO Details Side Panel */}
          <GPODetailsPanel
            operationCode={selectedOperation?.code || ''}
            gpoName={selectedGpo}
            onClose={() => setSelectedGpo(null)}
          />
        </>
      )}

      {/* Initial state - no analysis run yet */}
      {!overviewData && !analyzing && (
        <div className="bg-white rounded-lg shadow-sm border border-warm-200 p-8 text-center">
          <FileSpreadsheet className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-700 mb-2">
            Ready to Analyze
          </h3>
          <p className="text-gray-500 mb-4">
            Select an operation and click "Run Analysis" to view GPO details and bucket distribution
          </p>
        </div>
      )}
    </div>
  );
}

// Tab 1: Bucket Overview
function BucketOverviewTab({ data }: { data: DomainBucketOverview }) {
  const bucketOrder = ['Server', 'Workstation', 'User', 'Mixed', 'Unknown', 'Domain Controller', 'Domain Root'];
  const sortedBuckets = bucketOrder
    .filter(b => data.bucket_counts[b] !== undefined)
    .map(b => ({ bucket: b, count: data.bucket_counts[b] }));

  return (
    <div className="space-y-6">
      {/* Top Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard value={data.total_gpos} label="Total GPOs" />
        <MetricCard 
          value={data.migration_summary.MIGRATE} 
          label="Ready to Migrate" 
          className="border-l-4 border-green-500"
        />
        <MetricCard 
          value={data.migration_summary.REVIEW} 
          label="Needs Review" 
          className="border-l-4 border-yellow-500"
        />
        <MetricCard 
          value={data.migration_summary["DON'T MIGRATE"]} 
          label="Don't Migrate" 
          className="border-l-4 border-red-500"
        />
      </div>

      {/* Bucket Breakdown */}
      <div className="bg-warm-50 rounded-lg p-6 border border-warm-200">
        <h3 className="text-lg font-semibold mb-4">GPOs by Bucket</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {sortedBuckets.map(({ bucket, count }) => (
            <div 
              key={bucket}
              className="bg-white rounded-lg p-4 border border-warm-200 text-center"
            >
              <div className="text-2xl font-bold text-primary-600">{count}</div>
              <div className="text-sm text-gray-600">{bucket}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// GPO List Tab (used for Server, Workstation, User, Review tabs)
interface GPOListTabProps {
  data: PaginatedResponse<GPORow>;
  page: number;
  onPageChange: (page: number) => void;
  emptyMessage: string;
  tabType: 'server' | 'workstation' | 'user' | 'review';
  onRowClick?: (gpoName: string) => void;
  selectedGpo?: string | null;
}

// Helper to render Linked To with line breaks
const LinkedToCell = ({ value }: { value: string }) => {
  if (!value) return null;
  const lines = String(value).split('\n');
  return (
    <div className="text-sm whitespace-pre-line">
      {lines.map((line, i) => (
        <div key={i}>{line}</div>
      ))}
    </div>
  );
};

function GPOListTab({ data, page, onPageChange, emptyMessage, tabType, onRowClick, selectedGpo }: GPOListTabProps) {
  // Base columns for all tabs
  const baseColumns = [
    createColumn<GPORow>('gpo_name', 'GPO Name'),
    createColumn<GPORow>('linked_to', 'Linked To', {
      cell: (value) => <LinkedToCell value={String(value || '')} />,
    }),
    createColumn<GPORow>('applies_to', 'Applies To', {
      cell: (value) => <AppliesToTooltip appliesTo={String(value || 'Unknown')} />,
    }),
    createColumn<GPORow>('settings_count', 'Settings'),
    createColumn<GPORow>('bucket', 'Bucket'),
    createColumn<GPORow>('readiness', 'Readiness', {
      cell: (value) => <ReadinessTooltip readiness={String(value || 'Review First')} />,
    }),
  ];

  // Add Optimization Note for User tab with tooltip
  if (tabType === 'user') {
    baseColumns.push(
      createColumn<GPORow>('optimization_note', 'Optimization Note', {
        cell: (value, row) => value ? (
          <OptimizationTooltip note={String(value)} appliesTo={row.applies_to} />
        ) : null,
      })
    );
  }

  // Add Action column for Review Required tab and different columns
  if (tabType === 'review') {
    // Review tab has different columns: add Match Type, Action, and Detection Reason
    const reviewColumns = [
      createColumn<GPORow>('gpo_name', 'GPO Name'),
      createColumn<GPORow>('bucket', 'Bucket', {
        cell: (value) => {
          const bucket = String(value);
          const colorMap: Record<string, string> = {
            'Unknown': 'bg-yellow-100 text-yellow-800',
            'Mixed': 'bg-orange-100 text-orange-800',
            'Domain Root': 'bg-gray-100 text-gray-800',
            'Domain Controller': 'bg-red-100 text-red-800',
          };
          return (
            <span className={`px-2 py-1 rounded text-xs ${colorMap[bucket] || 'bg-gray-100 text-gray-800'}`}>
              {bucket}
            </span>
          );
        },
      }),
      createColumn<GPORow>('match_type', 'Match Type', {
        cell: (value) => {
          const matchType = String(value);
          const isLinksOnly = matchType.includes('Links Only');
          return (
            <span className={`px-2 py-1 rounded text-xs ${
              isLinksOnly ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'
            }`}>
              {matchType}
            </span>
          );
        },
      }),
      createColumn<GPORow>('action', 'Action', {
        cell: (value) => <ActionTooltip action={String(value || '')} />,
      }),
      createColumn<GPORow>('detection_reason', 'Detection Reason', {
        cell: (value) => {
          const reason = String(value || '');
          if (!reason) return <span className="text-gray-400 text-xs">—</span>;
          return (
            <span className="text-xs text-gray-600" title={reason}>
              {reason.length > 60 ? reason.substring(0, 60) + '...' : reason}
            </span>
          );
        },
      }),
      createColumn<GPORow>('applies_to', 'Applies To', {
        cell: (value) => <AppliesToTooltip appliesTo={String(value || 'Unknown')} />,
      }),
      createColumn<GPORow>('linked_to', 'Linked To', {
        cell: (value) => <LinkedToCell value={String(value || '')} />,
      }),
      createColumn<GPORow>('settings_count', 'Settings'),
    ];

    if (data.data.length === 0) {
      return (
        <div>
          <Legend tabType={tabType} />
          <div className="flex items-center justify-center h-64 text-gray-500">
            <p>{emptyMessage}</p>
          </div>
        </div>
      );
    }

    return (
      <div>
        <Legend tabType={tabType} />
        <DataTable
          data={data.data}
          columns={reviewColumns}
          searchPlaceholder="Search GPOs..."
          onRowClick={(row) => onRowClick?.(row.gpo_name)}
          getRowId={(row) => row.gpo_name}
          selectedRowId={selectedGpo}
          serverPagination={{
            page,
            totalPages: data.total_pages,
            total: data.total,
            onPageChange,
          }}
        />
      </div>
    );
  }

  if (data.data.length === 0) {
    return (
      <div>
        <Legend tabType={tabType} />
        <div className="flex items-center justify-center h-64 text-gray-500">
          <p>{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Legend tabType={tabType} />
      <DataTable
        data={data.data}
        columns={baseColumns}
        searchPlaceholder="Search GPOs..."
        onRowClick={(row) => onRowClick?.(row.gpo_name)}
        getRowId={(row) => row.gpo_name}
        selectedRowId={selectedGpo}
        serverPagination={{
          page,
          totalPages: data.total_pages,
          total: data.total,
          onPageChange,
        }}
      />
    </div>
  );
}
