import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, FileText, Download } from 'lucide-react';

/**
 * Simple markdown renderer for help documentation.
 * Renders markdown files from /docs/ with proper formatting.
 * No external dependencies - uses basic regex parsing.
 */

interface ParsedContent {
  html: string;
}

function parseMarkdown(markdown: string): ParsedContent {
  // Store code blocks temporarily to protect them from other transformations
  const codeBlocks: string[] = [];
  let html = markdown;

  // Extract and protect code blocks first (triple backticks)
  html = html.replace(/```([\s\S]*?)```/g, (_match, code) => {
    const index = codeBlocks.length;
    // Trim the first line if it's a language identifier
    let codeContent = code;
    const firstNewline = code.indexOf('\n');
    if (firstNewline > -1) {
      const firstLine = code.substring(0, firstNewline).trim();
      // If first line looks like a language identifier (no spaces, short), skip it
      if (firstLine.length < 20 && !firstLine.includes(' ')) {
        codeContent = code.substring(firstNewline + 1);
      }
    }
    codeBlocks.push(codeContent);
    return `__CODE_BLOCK_${index}__`;
  });

  // Now escape HTML entities (code blocks are protected)
  html = html.replace(/&/g, '&amp;');
  html = html.replace(/</g, '&lt;');
  html = html.replace(/>/g, '&gt;');

  // Horizontal rules (before headers to avoid conflict)
  html = html.replace(/^---+$/gm, '<hr class="my-6 border-gray-300" />');

  // Headers (process in order: h3, h2, h1 to avoid conflicts)
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold text-gray-800 mt-6 mb-3">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold text-gray-900 mt-8 mb-4 pb-2 border-b border-gray-200">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold text-gray-900 mb-2">$1</h1>');

  // Helper function to apply inline formatting (bold, italic, code)
  const applyInlineFormatting = (text: string): string => {
    let result = text;
    result = result.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>');
    result = result.replace(/\*(.+?)\*/g, '<em>$1</em>');
    result = result.replace(/`([^`_]+)`/g, '<code class="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono text-gray-800">$1</code>');
    return result;
  };

  // Tables - process before inline formatting to handle cells properly
  const tableRegex = /^\|(.+)\|$/gm;
  html = html.replace(tableRegex, (_match, content) => {
    const cells = content.split('|').map((c: string) => c.trim());
    // Check if this is a separator row
    if (cells.every((c: string) => /^[-:]+$/.test(c))) {
      return '<!-- table separator -->';
    }
    // Apply inline formatting to each cell with vertical alignment
    const cellHtml = cells.map((c: string) =>
      `<td class="border border-gray-300 px-3 py-2 align-top">${applyInlineFormatting(c)}</td>`
    ).join('');
    return `<tr>${cellHtml}</tr>`;
  });

  // Wrap consecutive table rows in table tags
  html = html.replace(/((?:<tr>.*<\/tr>\n?)+)/g, (match) => {
    const cleanedMatch = match.replace(/<!-- table separator -->\n?/g, '');
    if (!cleanedMatch.trim()) return '';
    // First row becomes header
    const rows = cleanedMatch.trim().split('\n').filter(r => r.trim());
    if (rows.length === 0) return '';
    const headerRow = rows[0]
      .replace(/<td/g, '<th')
      .replace(/<\/td>/g, '</th>')
      .replace(/text-left/g, 'text-left font-semibold bg-gray-100');
    const bodyRows = rows.slice(1).join('\n');
    return `<table class="w-full border-collapse text-sm my-4" style="table-layout: fixed;">
      <thead>${headerRow}</thead>
      <tbody>${bodyRows}</tbody>
    </table>`;
  });

  // Apply inline formatting to non-table content
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Inline code (single backticks, but not the placeholders)
  html = html.replace(/`([^`_]+)`/g, '<code class="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono text-gray-800">$1</code>');

  // Lists (unordered) - must come before paragraphs
  html = html.replace(/^- (.+)$/gm, '<li class="ml-4 mb-1">$1</li>');

  // Wrap consecutive list items
  html = html.replace(/((?:<li class="ml-4 mb-1">.*<\/li>\n?)+)/g, '<ul class="list-disc list-inside my-3 space-y-1">$1</ul>');

  // Numbered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li class="ml-4 mb-1 list-decimal">$1</li>');

  // Links (internal anchors)
  html = html.replace(/\[([^\]]+)\]\(#([^)]+)\)/g, '<a href="#$2" class="text-blue-600 hover:underline">$1</a>');

  // Links (external/relative)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-600 hover:underline">$1</a>');

  // Paragraphs - wrap standalone text blocks
  html = html.split('\n\n').map(block => {
    const trimmed = block.trim();
    if (!trimmed) return '';
    // Don't wrap if already an HTML element or a placeholder
    if (trimmed.startsWith('<') || trimmed.startsWith('__CODE_BLOCK_')) return trimmed;
    // Wrap in paragraph
    return `<p class="mb-4 text-gray-700 leading-relaxed">${trimmed.replace(/\n/g, '<br />')}</p>`;
  }).join('\n');

  // Restore code blocks with proper formatting
  codeBlocks.forEach((code, index) => {
    // Escape HTML in code content
    const escapedCode = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const codeHtml = `<pre class="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto my-4 text-sm font-mono whitespace-pre leading-relaxed">${escapedCode}</pre>`;
    html = html.replace(`__CODE_BLOCK_${index}__`, codeHtml);
  });

  return { html };
}

export default function HelpPage() {
  const { docName } = useParams<{ docName: string }>();
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const docPath = `/docs/${docName}.md`;
  const pdfPath = `/docs/${docName}.pdf`;

  useEffect(() => {
    setLoading(true);
    setError(null);

    fetch(docPath)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Document not found: ${docName}`);
        }
        return response.text();
      })
      .then(text => {
        setContent(text);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [docName, docPath]);

  const parsed = content ? parseMarkdown(content) : null;

  // Document titles for display
  const docTitles: Record<string, string> = {
    'MigrationReport_AnalysisGuide': 'Migration Report Analysis Guide',
    'MigrationReport_CheatSheet': 'Migration Report Quick Reference',
  };

  const title = docTitles[docName || ''] || docName || 'Help Document';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/migration"
              className="text-gray-500 hover:text-gray-700 flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Migration
            </Link>
            <span className="text-gray-300">|</span>
            <div className="flex items-center gap-2 text-gray-700">
              <FileText className="h-5 w-5" />
              <span className="font-medium">{title}</span>
            </div>
          </div>

          {/* PDF Download (if exists) */}
          <a
            href={pdfPath}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 transition-colors"
            title="Download PDF version"
          >
            <Download className="h-4 w-4" />
            PDF
          </a>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-500">Loading documentation...</span>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
              <strong>Error:</strong> {error}
            </div>
          )}

          {parsed && (
            <div
              className="prose prose-gray max-w-none"
              dangerouslySetInnerHTML={{ __html: parsed.html }}
            />
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-sm text-gray-500">
          GPO Analyzer v2.3.3 | Web Interface v3.3.0
        </div>
      </div>
    </div>
  );
}
