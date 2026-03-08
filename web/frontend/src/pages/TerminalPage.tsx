import { useEffect, useRef, useState } from 'react';
import { Terminal as TerminalIcon, Maximize2, Minimize2, RotateCcw, ChevronDown, ChevronUp, Copy, Clipboard } from 'lucide-react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

// Terminal theme - dark with accent colors
const terminalTheme = {
  background: '#1a1b26',      // Dark blue-gray
  foreground: '#c0caf5',      // Light blue-white
  cursor: '#c0caf5',
  cursorAccent: '#1a1b26',
  selectionBackground: '#33467c',
  black: '#15161e',
  red: '#f7768e',             // Errors
  green: '#9ece6a',           // Success
  yellow: '#e0af68',          // Warnings
  blue: '#7aa2f7',            // Info
  magenta: '#bb9af7',
  cyan: '#7dcfff',
  white: '#a9b1d6',
  brightBlack: '#414868',
  brightRed: '#f7768e',
  brightGreen: '#9ece6a',
  brightYellow: '#e0af68',
  brightBlue: '#7aa2f7',
  brightMagenta: '#bb9af7',
  brightCyan: '#7dcfff',
  brightWhite: '#c0caf5',
};

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// Command examples for quick reference
const commandExamples = [
  {
    title: 'Executive Report',
    description: 'Cross-domain summary for leadership (7 tabs)',
    command: 'python gpo_analyzer.py --mode executive --html-folder data/html_reports --output data/downloads/executive.xlsx'
  },
  {
    title: 'Domain Report',
    description: 'Single operation analysis (5 tabs)',
    command: 'python gpo_analyzer.py --mode domain --operation OPG --html-folder data/html_reports --output data/downloads/golf.xlsx'
  },
  {
    title: 'Migration Analysis',
    description: 'Compare domain to enterprise baseline (4 tabs: Summary, GPO Summary, Settings Analysis, Review Required)',
    command: 'python gpo_analyzer.py --mode migration --domain corp.bravo.com --html-folder data/html_reports --output data/downloads/bravo_migration.xlsx'
  },
  {
    title: 'Impact Analysis (CLI Only)',
    description: 'GPO replacement impact - what happens when you swap operation GPOs for enterprise standard equivalents (5 tabs)',
    command: 'python gpo_analyzer.py --mode impact --domain corp.alpha.com --html-folder data/html_reports --output data/downloads/alpha_impact.xlsx'
  },
  {
    title: 'Full Analysis (CLI Only)',
    description: 'Complete 19-tab report - not available in dashboard',
    command: 'python gpo_analyzer.py --mode full --html-folder data/html_reports --output data/downloads/full_analysis.xlsx'
  },
  {
    title: 'Debug Mode (CLI Only)',
    description: 'Verbose logging for troubleshooting',
    command: 'python gpo_analyzer.py --mode executive --html-folder data/html_reports --debug --log-file data/downloads/debug.log --output data/downloads/executive_debug.xlsx'
  }
];

// Impact Mode detailed documentation
const impactModeInfo = {
  purpose: 'Answers: "What happens when I replace operation GPOs with enterprise standard equivalents?"',
  useCase: 'Run AFTER migration planning, BEFORE execution - validates the impact of GPO replacement',
  tabs: [
    { name: 'Impact_Summary', desc: 'Per-GPO risk assessment (HIGH/MEDIUM/LOW) with explanation' },
    { name: 'Settings_Retained', desc: 'Settings that stay the same - no action needed' },
    { name: 'Settings_Lost', desc: 'CRITICAL: Settings that will be lost if not migrated elsewhere' },
    { name: 'Settings_Changed', desc: 'CRITICAL: Settings with different values - review before switch' },
    { name: 'Settings_Added', desc: 'New settings from enterprise standards that will apply after migration' },
  ],
  riskLevels: [
    { level: 'HIGH', criteria: 'Lost > 5 OR Changed > 3', action: 'Significant changes - careful review required' },
    { level: 'MEDIUM', criteria: 'Lost > 0 OR Changed > 0', action: 'Some settings require action before replacement' },
    { level: 'LOW', criteria: 'Lost = 0 AND Changed = 0', action: 'Safe replacement - only gains new settings' },
  ]
};

const operationCodes = {
  standalone: ['OPA', 'OPB', 'OPC', 'OPD', 'OPE'],
  shared_forest: ['OPF', 'OPG', 'OPH', 'OPI', 'OPJ']
};

export function TerminalPage() {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstance = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showReference, setShowReference] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Build WebSocket URL dynamically
  const getWsUrl = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.hostname}:9846/api/terminal/ws`;
  };

  const connect = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setStatus('connecting');

    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
      // Send initial resize
      if (terminalInstance.current && fitAddon.current) {
        fitAddon.current.fit();
        const dims = fitAddon.current.proposeDimensions();
        if (dims) {
          ws.send(JSON.stringify({
            type: 'resize',
            rows: dims.rows,
            cols: dims.cols,
          }));
        }
      }
    };

    ws.onmessage = (event) => {
      if (terminalInstance.current) {
        terminalInstance.current.write(event.data);
      }
    };

    ws.onclose = () => {
      setStatus('disconnected');
      if (terminalInstance.current) {
        terminalInstance.current.write('\r\n\x1b[1;31m[Connection closed]\x1b[0m\r\n');
      }
    };

    ws.onerror = () => {
      setStatus('error');
      if (terminalInstance.current) {
        terminalInstance.current.write('\r\n\x1b[1;31m[Connection error]\x1b[0m\r\n');
      }
    };
  };

  const disconnect = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus('disconnected');
  };

  const reconnect = () => {
    disconnect();
    if (terminalInstance.current) {
      terminalInstance.current.clear();
    }
    setTimeout(connect, 100);
  };

  // Paste from clipboard into terminal
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(text);
      }
    } catch (err) {
      console.error('Failed to paste:', err);
    }
  };

  // Copy command to clipboard
  const copyCommand = async (command: string, index: number) => {
    try {
      await navigator.clipboard.writeText(command);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Paste command directly to terminal
  const pasteToTerminal = (command: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(command);
    }
  };

  // Initialize terminal
  useEffect(() => {
    if (!terminalRef.current || terminalInstance.current) return;

    const term = new Terminal({
      theme: terminalTheme,
      fontFamily: '"JetBrains Mono", "Fira Code", "SF Mono", Menlo, Monaco, "Courier New", monospace',
      fontSize: 14,
      lineHeight: 1.2,
      cursorBlink: true,
      cursorStyle: 'block',
      allowProposedApi: true,
    });

    const fit = new FitAddon();
    const webLinks = new WebLinksAddon();

    term.loadAddon(fit);
    term.loadAddon(webLinks);

    term.open(terminalRef.current);
    fit.fit();

    terminalInstance.current = term;
    fitAddon.current = fit;

    // Handle user input
    term.onData((data) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(data);
      }
    });

    // Handle resize
    const handleResize = () => {
      if (fitAddon.current) {
        fitAddon.current.fit();
        const dims = fitAddon.current.proposeDimensions();
        if (dims && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'resize',
            rows: dims.rows,
            cols: dims.cols,
          }));
        }
      }
    };

    window.addEventListener('resize', handleResize);

    // Connect automatically
    connect();

    return () => {
      window.removeEventListener('resize', handleResize);
      disconnect();
      term.dispose();
      terminalInstance.current = null;
      fitAddon.current = null;
    };
  }, []);

  // Handle fullscreen toggle
  useEffect(() => {
    if (fitAddon.current) {
      setTimeout(() => {
        fitAddon.current?.fit();
      }, 100);
    }
  }, [isFullscreen]);

  const statusColor = {
    disconnected: 'bg-gray-500',
    connecting: 'bg-yellow-500',
    connected: 'bg-green-500',
    error: 'bg-red-500',
  };

  const statusText = {
    disconnected: 'Disconnected',
    connecting: 'Connecting...',
    connected: 'Connected',
    error: 'Error',
  };

  return (
    <div className={`flex flex-col ${isFullscreen ? 'fixed inset-0 z-50 bg-gray-900' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <TerminalIcon className="w-5 h-5 text-cyan-400" />
          <span className="text-white font-medium">GPO Analyzer Terminal</span>
          <div className="flex items-center gap-2 ml-4">
            <div className={`w-2 h-2 rounded-full ${statusColor[status]}`} />
            <span className="text-sm text-gray-400">{statusText[status]}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePaste}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
            title="Paste from clipboard (Ctrl+Shift+V)"
          >
            <Clipboard className="w-4 h-4" />
          </button>
          <button
            onClick={reconnect}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
            title="Reconnect"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Terminal */}
      <div 
        ref={terminalRef}
        className="flex-1 bg-[#1a1b26] p-2"
        style={{ minHeight: isFullscreen ? 'calc(100vh - 88px)' : '500px' }}
      />

      {/* Help bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-t border-gray-700 text-xs text-gray-500">
        <div className="flex items-center gap-4">
          <span>
            <kbd className="px-1 py-0.5 bg-gray-700 rounded text-gray-300">Ctrl+Shift+V</kbd>
            {' '}paste
          </span>
          <span>
            <kbd className="px-1 py-0.5 bg-gray-700 rounded text-gray-300">Ctrl+C</kbd>
            {' '}cancel
          </span>
          <span>
            <kbd className="px-1 py-0.5 bg-gray-700 rounded text-gray-300">clear</kbd>
            {' '}clear screen
          </span>
        </div>
        {!isFullscreen && (
          <button
            onClick={() => setShowReference(!showReference)}
            className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            {showReference ? 'Hide' : 'Show'} Quick Reference
            {showReference ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Quick Reference Section (collapsible) */}
      {showReference && !isFullscreen && (
        <div className="bg-warm-50 border-t border-warm-200 p-4 max-h-96 overflow-y-auto">
          <div className="max-w-4xl mx-auto">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">CLI Quick Reference</h3>
            
            {/* Command Examples */}
            <div className="space-y-3 mb-6">
              {commandExamples.map((example, index) => (
                <div key={index} className="bg-white rounded-lg border border-warm-200 p-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-800">{example.title}</span>
                        {example.title.includes('CLI Only') && (
                          <span className="px-2 py-0.5 text-xs bg-orange-100 text-orange-700 rounded">CLI Only</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">{example.description}</p>
                      <code className="block mt-2 text-xs bg-gray-100 text-gray-700 p-2 rounded font-mono overflow-x-auto">
                        {example.command}
                      </code>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={() => copyCommand(example.command, index)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                        title="Copy to clipboard"
                      >
                        {copiedIndex === index ? (
                          <span className="text-green-500 text-xs">✓</span>
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => pasteToTerminal(example.command)}
                        className="p-1.5 text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 rounded transition-colors"
                        title="Paste to terminal"
                      >
                        <TerminalIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Operation Codes */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-lg border border-warm-200 p-3">
                <h4 className="font-medium text-gray-800 mb-2">Standalone Operations</h4>
                <p className="text-xs text-gray-500 mb-2">Domains with their own AD forest</p>
                <div className="flex flex-wrap gap-1">
                  {operationCodes.standalone.map(code => (
                    <span key={code} className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded font-mono">
                      {code}
                    </span>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-lg border border-warm-200 p-3">
                <h4 className="font-medium text-gray-800 mb-2">Shared Forest Operations</h4>
                <p className="text-xs text-gray-500 mb-2">Operations in baseline.corp (shared forest)</p>
                <div className="flex flex-wrap gap-1">
                  {operationCodes.shared_forest.map(code => (
                    <span key={code} className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded font-mono">
                      {code}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Impact Mode Deep Dive */}
            <div className="mt-4 bg-white rounded-lg border border-purple-200 p-3">
              <h4 className="font-medium text-purple-800 mb-2">📊 Impact Mode (CLI Only) - GPO Replacement Analysis</h4>
              <p className="text-sm text-gray-600 mb-3">{impactModeInfo.purpose}</p>
              <p className="text-xs text-gray-500 mb-3"><strong>When to use:</strong> {impactModeInfo.useCase}</p>
              
              <div className="grid grid-cols-2 gap-4">
                {/* Output Tabs */}
                <div>
                  <h5 className="text-xs font-semibold text-gray-700 mb-2">OUTPUT TABS</h5>
                  <div className="space-y-1">
                    {impactModeInfo.tabs.map((tab, idx) => (
                      <div key={idx} className="text-xs">
                        <span className={`font-mono ${tab.name.includes('Lost') || tab.name.includes('Changed') ? 'text-red-600 font-semibold' : 'text-gray-700'}`}>
                          {tab.name}
                        </span>
                        <span className="text-gray-500 ml-1">- {tab.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Risk Levels */}
                <div>
                  <h5 className="text-xs font-semibold text-gray-700 mb-2">RISK ASSESSMENT</h5>
                  <div className="space-y-1">
                    {impactModeInfo.riskLevels.map((risk, idx) => (
                      <div key={idx} className="text-xs flex items-start gap-2">
                        <span className={`px-1.5 py-0.5 rounded font-semibold ${
                          risk.level === 'HIGH' ? 'bg-red-100 text-red-700' :
                          risk.level === 'MEDIUM' ? 'bg-amber-100 text-amber-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {risk.level}
                        </span>
                        <span className="text-gray-600">{risk.criteria}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Folder Structure */}
            <div className="mt-4 bg-white rounded-lg border border-warm-200 p-3">
              <h4 className="font-medium text-gray-800 mb-2">Folder Structure & Downloads</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <code className="text-cyan-600">/app/data/html_reports/</code>
                  <p className="text-gray-500 text-xs mt-0.5">Input: GPOZaurr HTML reports</p>
                </div>
                <div>
                  <code className="text-cyan-600">/app/data/downloads/</code>
                  <p className="text-gray-500 text-xs mt-0.5">Output: CLI reports (clickable download URL)</p>
                </div>
              </div>
              <div className="mt-2 text-xs text-gray-500 bg-gray-50 p-2 rounded">
                <span className="text-green-600 font-medium">✓ Download Feature:</span> Save to <code>data/downloads/</code> → CLI prints clickable URL → Click to download. Files auto-delete after 60 min.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
