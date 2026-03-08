import { useState, useCallback, useEffect } from 'react';
import { Upload, Trash2, FileText, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import {
  uploadMultipleFiles,
  getUploadedFiles,
  deleteFile,
  refreshCache,
  getHealth,
} from '../services/api';
import type { UploadedFile, HealthResponse } from '../types';

export function UploadPage() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [filesData, healthData] = await Promise.all([
        getUploadedFiles(),
        getHealth(),
      ]);
      setFiles(filesData.files);
      setHealth(healthData);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to load file list' });
    } finally {
      setLoading(false);
    }
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      f => f.name.endsWith('.html')
    );

    if (droppedFiles.length > 0) {
      handleUpload(droppedFiles);
    } else {
      setMessage({ type: 'error', text: 'Only HTML files are accepted' });
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles) {
      const htmlFiles = Array.from(selectedFiles).filter(f => f.name.endsWith('.html'));
      if (htmlFiles.length > 0) {
        handleUpload(htmlFiles);
      }
    }
    e.target.value = ''; // Reset input
  };

  const handleUpload = async (filesToUpload: File[]) => {
    setUploading(true);
    setMessage(null);
    try {
      const result = await uploadMultipleFiles(filesToUpload);
      setMessage({
        type: result.successful > 0 ? 'success' : 'error',
        text: result.message,
      });
      await loadData(); // Refresh file list
    } catch (err) {
      setMessage({ type: 'error', text: 'Upload failed' });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (filename: string) => {
    if (!confirm(`Delete ${filename}?`)) return;

    try {
      await deleteFile(filename);
      setMessage({ type: 'success', text: `Deleted ${filename}` });
      await loadData();
    } catch (err) {
      setMessage({ type: 'error', text: `Failed to delete ${filename}` });
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    try {
      await refreshCache();
      setMessage({ type: 'success', text: 'Cache refreshed successfully' });
      await loadData();
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to refresh cache' });
    } finally {
      setLoading(false);
    }
  };

  if (loading && files.length === 0) {
    return <LoadingSpinner message="Loading files..." />;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">File Management</h1>

      {/* Status Banner */}
      {health && (
        <div className="bg-warm-100 rounded-lg p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className={`h-3 w-3 rounded-full ${health.status === 'healthy' ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm font-medium">API {health.status}</span>
            </div>
            <span className="text-sm text-gray-600">v{health.version}</span>
            <span className="text-sm text-gray-600">{health.html_files_count} files loaded</span>
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1 text-sm bg-primary-500 text-white rounded hover:bg-primary-600 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      )}

      {/* Message */}
      {message && (
        <div className={`mb-6 p-4 rounded-lg flex items-center gap-2 ${
          message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {message.type === 'success' ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          {message.text}
        </div>
      )}

      {/* Upload Zone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive
            ? 'border-primary-500 bg-primary-50'
            : 'border-warm-300 hover:border-primary-400 hover:bg-warm-50'
        }`}
      >
        {uploading ? (
          <LoadingSpinner message="Uploading..." />
        ) : (
          <>
            <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-lg font-medium text-gray-700 mb-2">
              Drop GPOZaurr HTML files here
            </p>
            <p className="text-sm text-gray-500 mb-4">or</p>
            <label className="cursor-pointer">
              <span className="px-4 py-2 bg-primary-500 text-white rounded hover:bg-primary-600 transition-colors">
                Browse Files
              </span>
              <input
                type="file"
                accept=".html"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
            <p className="text-xs text-gray-400 mt-4">
              Accepts .html files from GPOZaurr reports
            </p>
          </>
        )}
      </div>

      {/* File List */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          Uploaded Files ({files.length})
        </h2>

        {files.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <FileText className="h-12 w-12 mx-auto text-gray-300 mb-2" />
            <p>No HTML files uploaded yet</p>
            <p className="text-sm">Upload GPOZaurr HTML reports to begin analysis</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-warm-200 divide-y divide-warm-200">
            {files.map((file) => (
              <div
                key={file.filename}
                className="flex items-center justify-between p-4 hover:bg-warm-50"
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="font-medium text-gray-800">{file.filename}</p>
                    <p className="text-sm text-gray-500">
                      {file.size_kb.toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(file.filename)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  title="Delete file"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
