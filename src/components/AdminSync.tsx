import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, CheckCircle, XCircle, Clock, Database, Package, Image, FileText, Save } from 'lucide-react';
import { apiFetch, readJsonResponse } from '../lib/api';

interface SyncLog {
  id: string;
  sync_type: string;
  status: string;
  products_synced: number;
  variants_synced: number;
  started_at: string;
  completed_at: string;
  duration_ms: number;
  errors?: unknown;
}

interface TableStats {
  products: number;
  variants: number;
  images: number;
  categories: number;
}

interface SiteTagline {
  quoteText: string;
  attribution: string;
}

const defaultSiteTagline: SiteTagline = {
  quoteText: 'Your word is a lamp to my feet and a light to my path.',
  attribution: 'PSALM 119:105'
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function AdminSync() {
  const [syncing, setSyncing] = useState(false);
  const [savingTagline, setSavingTagline] = useState(false);
  const [taglineMessage, setTaglineMessage] = useState('');
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [siteTagline, setSiteTagline] = useState<SiteTagline>(defaultSiteTagline);
  const [stats, setStats] = useState<TableStats>({
    products: 0,
    variants: 0,
    images: 0,
    categories: 0
  });
  const [lastSync, setLastSync] = useState<SyncLog | null>(null);

  useEffect(() => {
    fetchSyncLogs();
    fetchStats();
    fetchSiteTagline();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await apiFetch('/api/admin/stats');
      const data = await readJsonResponse(response);
      setStats({
        products: data.stats?.products || 0,
        variants: data.stats?.variants || 0,
        images: data.stats?.images || 0,
        categories: data.stats?.categories || 0
      });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const fetchSyncLogs = async () => {
    try {
      const response = await apiFetch('/api/admin/sync-logs');
      const data = await readJsonResponse(response);

      if (data.success) {
        setSyncLogs(data.logs);
        if (data.logs.length > 0) {
          setLastSync(data.logs[0]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch sync logs:', error);
    }
  };

  const fetchSiteTagline = async () => {
    try {
      const response = await apiFetch('/api/admin/site-tagline');
      const data = await readJsonResponse(response);
      if (data.success && data.tagline) {
        setSiteTagline({
          quoteText: data.tagline.quoteText || defaultSiteTagline.quoteText,
          attribution: data.tagline.attribution || defaultSiteTagline.attribution
        });
      }
    } catch (error) {
      console.error('Failed to fetch site tagline:', error);
      setTaglineMessage('Unable to load tagline settings.');
    }
  };

  const handleTaglineChange = (field: keyof SiteTagline, value: string) => {
    setSiteTagline((current) => ({
      ...current,
      [field]: value
    }));
    setTaglineMessage('');
  };

  const handleSaveTagline = async () => {
    const quoteText = siteTagline.quoteText.trim();
    const attribution = siteTagline.attribution.trim();

    if (!quoteText || !attribution) {
      setTaglineMessage('Quote text and attribution are required.');
      return;
    }

    if (/[<>]/.test(quoteText) || /[<>]/.test(attribution)) {
      setTaglineMessage('Only plain text is allowed.');
      return;
    }

    setSavingTagline(true);
    setTaglineMessage('');

    try {
      const response = await apiFetch('/api/admin/site-tagline', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteText, attribution })
      });
      const data = await readJsonResponse(response);

      if (data.success && data.tagline) {
        setSiteTagline(data.tagline);
        setTaglineMessage('Tagline saved.');
      }
    } catch (error) {
      setTaglineMessage(getErrorMessage(error, 'Failed to save tagline.'));
    } finally {
      setSavingTagline(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const response = await apiFetch('/api/admin/sync-products', {
        method: 'POST'
      });

      const data = await readJsonResponse(response);

      if (response.ok && data.success) {
        await fetchSyncLogs();
        await fetchStats();
      } else {
        alert(`Sync failed: ${data.error || `Request failed with status ${response.status}`}`);
      }
    } catch (error) {
      alert(`Sync failed: ${getErrorMessage(error, 'Unknown error')}`);
    } finally {
      setSyncing(false);
    }
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-slate-900 mb-2">Admin Panel</h1>
        <p className="text-lg text-slate-600">
          Sync products from Gooten API to your store database
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            to="/admin/manage-products"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
          >
            Manage Products
          </Link>
          <Link
            to="/admin/manage-categories"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
          >
            Manage Categories
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <Package className="w-8 h-8 text-blue-600" />
            <span className="text-3xl font-bold text-slate-900">{stats.products}</span>
          </div>
          <h3 className="text-sm font-medium text-slate-600">Products</h3>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <FileText className="w-8 h-8 text-green-600" />
            <span className="text-3xl font-bold text-slate-900">{stats.variants}</span>
          </div>
          <h3 className="text-sm font-medium text-slate-600">Variants</h3>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <Image className="w-8 h-8 text-purple-600" />
            <span className="text-3xl font-bold text-slate-900">{stats.images}</span>
          </div>
          <h3 className="text-sm font-medium text-slate-600">Images</h3>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <Database className="w-8 h-8 text-orange-600" />
            <span className="text-3xl font-bold text-slate-900">{stats.categories}</span>
          </div>
          <h3 className="text-sm font-medium text-slate-600">Categories</h3>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Top Tagline</h2>
          <p className="text-slate-600">
            Manage the scripture banner text shown near the top of the store.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_280px]">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Quote Text</span>
            <textarea
              value={siteTagline.quoteText}
              onChange={(event) => handleTaglineChange('quoteText', event.target.value)}
              maxLength={240}
              rows={3}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Attribution</span>
            <input
              type="text"
              value={siteTagline.attribution}
              onChange={(event) => handleTaglineChange('attribution', event.target.value)}
              maxLength={80}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold uppercase tracking-widest text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>
        </div>

        <div className="mt-5 rounded-lg bg-[#d3a33c] px-4 py-3 text-center text-sm italic text-[#1c2b4a]">
          &ldquo;{siteTagline.quoteText || defaultSiteTagline.quoteText}&rdquo; &nbsp;
          <span className="not-italic font-bold tracking-widest">
            - {siteTagline.attribution || defaultSiteTagline.attribution}
          </span>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSaveTagline}
            disabled={savingTagline}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {savingTagline ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {savingTagline ? 'Saving...' : 'Save Tagline'}
          </button>
          {taglineMessage && (
            <p className="text-sm font-medium text-slate-600">{taglineMessage}</p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Sync Products</h2>
            <p className="text-slate-600">
              Import products and variants from Gooten API into your database
            </p>
          </div>

          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 transition-all font-semibold"
          >
            {syncing ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="w-5 h-5" />
                Sync Now
              </>
            )}
          </button>
        </div>

        {lastSync && (
          <div className="bg-slate-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              {lastSync.status === 'success' ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : lastSync.status === 'running' ? (
                <Clock className="w-5 h-5 text-blue-600 animate-spin" />
              ) : (
                <XCircle className="w-5 h-5 text-red-600" />
              )}
              <span className="font-semibold text-slate-900">Last Sync</span>
            </div>
            <div className="text-sm text-slate-600 space-y-1">
              <p>Started: {formatDate(lastSync.started_at)}</p>
              {lastSync.completed_at && (
                <>
                  <p>Duration: {formatDuration(lastSync.duration_ms)}</p>
                  <p>
                    Products: {lastSync.products_synced} | Variants: {lastSync.variants_synced}
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">Sync History</h2>

        {syncLogs.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <Database className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p>No sync history yet. Click "Sync Now" to start.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {syncLogs.map((log) => (
              <div
                key={log.id}
                className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {log.status === 'success' ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : log.status === 'running' ? (
                      <Clock className="w-5 h-5 text-blue-600" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600" />
                    )}

                    <div>
                      <p className="font-medium text-slate-900">
                        {log.sync_type.replace(/_/g, ' ').toUpperCase()}
                      </p>
                      <p className="text-sm text-slate-600">
                        {formatDate(log.started_at)}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    {log.completed_at && (
                      <>
                        <p className="text-sm font-medium text-slate-900">
                          {log.products_synced} products, {log.variants_synced} variants
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatDuration(log.duration_ms)}
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {Boolean(log.errors) && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                    <p className="font-medium mb-1">Errors occurred:</p>
                    <pre className="text-xs overflow-auto">
                      {JSON.stringify(log.errors, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
