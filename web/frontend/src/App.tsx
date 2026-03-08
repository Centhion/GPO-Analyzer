import { useState } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { useMsal, useAccount } from '@azure/msal-react';
import { LayoutDashboard, Building2, Upload, Menu, X, RefreshCw, GitCompare, FileText, LogOut, User } from 'lucide-react';
import { AuthGuard } from './components/auth/AuthGuard';
import { ExecutiveDashboard } from './pages/ExecutiveDashboard';
import { OptimizationDashboard } from './pages/OptimizationDashboard';
import { MigrationDashboard } from './pages/MigrationDashboard';
import { CLIReportsPage } from './pages/CLIReportsPage';
import { UploadPage } from './pages/UploadPage';
import HelpPage from './pages/HelpPage';
import { refreshCache } from './services/api';
import './index.css';

function App() {
  return (
    <AuthGuard>
      <BrowserRouter>
        <AppLayout />
      </BrowserRouter>
    </AuthGuard>
  );
}

function AppLayout() {
  const location = useLocation();
  const { instance, accounts } = useMsal();
  const account = useAccount(accounts[0] || null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);

  const handleLogout = () => {
    instance.logoutRedirect({
      postLogoutRedirectUri: window.location.origin,
    });
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setRefreshMessage(null);
    try {
      const result = await refreshCache();
      setRefreshMessage(`✓ Refreshed: ${result.active_gpos} GPOs analyzed`);
      // Clear message after 3 seconds
      setTimeout(() => setRefreshMessage(null), 3000);
    } catch (err) {
      setRefreshMessage('✗ Refresh failed');
      setTimeout(() => setRefreshMessage(null), 3000);
    } finally {
      setIsRefreshing(false);
    }
  };

  const isExecutive = location.pathname === '/' || location.pathname === '/executive';
  const isOptimization = location.pathname === '/optimization';
  const isMigration = location.pathname === '/migration';
  const isCLIReports = location.pathname === '/cli-reports';
  const isUpload = location.pathname === '/upload';

  return (
    <div className="min-h-screen flex flex-col bg-warm-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-warm-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo / Title */}
            <div className="flex items-center gap-3">
              <div className="text-2xl">🏢</div>
              <div>
                <h1 className="text-lg font-bold text-gray-800">GPO Analyzer</h1>
                <p className="text-xs text-gray-500">v3.3.0</p>
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-4">
              <Link
                to="/executive"
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  isExecutive
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-600 hover:bg-warm-100'
                }`}
              >
                <LayoutDashboard className="h-4 w-4" />
                Executive
              </Link>

              <Link
                to="/optimization"
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  isOptimization
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-600 hover:bg-warm-100'
                }`}
              >
                <Building2 className="h-4 w-4" />
                Optimization
              </Link>

              <Link
                to="/migration"
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  isMigration
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-600 hover:bg-warm-100'
                }`}
              >
                <GitCompare className="h-4 w-4" />
                Migration
              </Link>

              <Link
                to="/cli-reports"
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  isCLIReports
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-600 hover:bg-warm-100'
                }`}
              >
                <FileText className="h-4 w-4" />
                CLI Reports
              </Link>

              <Link
                to="/upload"
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  isUpload
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-600 hover:bg-warm-100'
                }`}
              >
                <Upload className="h-4 w-4" />
                Upload
              </Link>

              {/* Refresh Button */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                    isRefreshing
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'text-gray-600 hover:bg-warm-100 hover:text-primary-600'
                  }`}
                  title="Re-analyze all data (use after updating analyzer code)"
                >
                  <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  {isRefreshing ? 'Refreshing...' : 'Refresh'}
                </button>
                {refreshMessage && (
                  <span className={`text-xs px-2 py-1 rounded ${
                    refreshMessage.startsWith('✓') 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {refreshMessage}
                  </span>
                )}
              </div>

              {/* User Menu */}
              <div className="flex items-center gap-2 pl-4 border-l border-gray-200">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <User className="h-4 w-4" />
                  <span className="max-w-[150px] truncate" title={account?.name || account?.username || 'User'}>
                    {account?.name || account?.username || 'User'}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1 px-2 py-1 text-sm text-gray-500 hover:text-gray-700 hover:bg-warm-100 rounded transition-colors"
                  title="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </nav>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-warm-100"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-warm-200 py-2">
            <Link
              to="/executive"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-4 py-2 text-gray-700 hover:bg-warm-100"
            >
              Executive Dashboard
            </Link>
            <Link
              to="/optimization"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-4 py-2 text-gray-700 hover:bg-warm-100"
            >
              Optimization Mode
            </Link>
            <Link
              to="/migration"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-4 py-2 text-gray-700 hover:bg-warm-100"
            >
              Migration Mode
            </Link>
            <Link
              to="/cli-reports"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-4 py-2 text-gray-700 hover:bg-warm-100"
            >
              CLI Reports
            </Link>
            <Link
              to="/upload"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-4 py-2 text-gray-700 hover:bg-warm-100"
            >
              Upload Files
            </Link>
            <button
              onClick={() => {
                handleRefresh();
                setMobileMenuOpen(false);
              }}
              disabled={isRefreshing}
              className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-warm-100 disabled:text-gray-400"
            >
              {isRefreshing ? '↻ Refreshing...' : '↻ Refresh Data'}
            </button>
            <div className="border-t border-gray-200 mt-2 pt-2">
              <div className="px-4 py-2 text-sm text-gray-500">
                Signed in as: {account?.name || account?.username || 'User'}
              </div>
              <button
                onClick={() => {
                  handleLogout();
                  setMobileMenuOpen(false);
                }}
                className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-warm-100"
              >
                Sign out
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8">
        <Routes>
          <Route path="/" element={<ExecutiveDashboard />} />
          <Route path="/executive" element={<ExecutiveDashboard />} />
          <Route path="/optimization" element={<OptimizationDashboard />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/migration" element={<MigrationDashboard />} />
          <Route path="/cli-reports" element={<CLIReportsPage />} />
          <Route path="/help/:docName" element={<HelpPage />} />
        </Routes>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-warm-200 py-4">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-gray-500">
          GPO Analyzer v3.3.0 • Based on v2.3.2 Core • Contact: Eric Tamez
        </div>
      </footer>
    </div>
  );
}

export default App;
