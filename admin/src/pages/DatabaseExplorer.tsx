import React, { useEffect, useState } from 'react';
import {
  Database, RefreshCw, Download, Search, Table,
  Code2, Eye, X, ChevronRight, Layers, FileJson
} from 'lucide-react';
import api from '@/api/client';
import { useToastStore } from '@/store';

export function DatabaseExplorer() {
  const { toast } = useToastStore();
  const [overview, setOverview] = useState<any>(null);
  const [selectedCol, setSelectedCol] = useState<string>('users');
  const [records, setRecords] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);

  const loadOverview = async () => {
    try {
      const res = await api.get('/database/overview');
      setOverview(res.data.data);
    } catch {
      toast({ type: 'error', message: 'Failed to load database overview' });
    }
  };

  const loadCollection = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/database/collection/${selectedCol}`, {
        params: { page, limit: 15, search },
      });
      setRecords(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch {
      toast({ type: 'error', message: `Failed to load collection ${selectedCol}` });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  useEffect(() => {
    loadCollection();
  }, [selectedCol, page, search]);

  const handleExport = async () => {
    try {
      const res = await api.post(`/database/export/${selectedCol}`);
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(res.data.data, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `${selectedCol}_export_${Date.now()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      toast({ type: 'success', message: `Exported ${res.data.count} records from ${selectedCol}` });
    } catch {
      toast({ type: 'error', message: 'Export failed' });
    }
  };

  const collections = overview?.collections || [];

  return (
    <div className="space-y-6 animate-fade">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Database size={22} className="text-amber-400" /> Database Collection Browser
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Low-level inspect, filter, query, and export system collections in {overview?.database_name || 'axis_black_db'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:border-amber-400 text-xs text-slate-300 font-medium transition-all"
          >
            <Download size={13} className="text-amber-400" />
            <span>Export Collection JSON</span>
          </button>
          <button
            onClick={() => { loadOverview(); loadCollection(); }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:border-cyan-400 text-xs text-slate-300 font-medium transition-all"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin text-cyan-400' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Collection Buttons Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5">
        {collections.map((c: any) => {
          const isSelected = selectedCol === c.name;
          return (
            <button
              key={c.name}
              onClick={() => { setSelectedCol(c.name); setPage(1); setSearch(''); }}
              className={`p-3 rounded-xl border text-left transition-all ${
                isSelected
                  ? 'bg-amber-400/10 border-amber-400/50 text-white shadow-lg shadow-amber-400/5'
                  : 'bg-navy-900 border-white/8 text-slate-400 hover:text-white hover:border-white/15'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold truncate">{c.name}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                  isSelected ? 'bg-amber-400 text-black' : 'bg-white/5 text-slate-400'
                }`}>
                  {c.count}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Search and Details Header */}
      <div className="p-4 rounded-2xl bg-navy-900 border border-white/8 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers size={16} className="text-amber-400" />
          <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
            Collection: <strong className="text-amber-400">{selectedCol}</strong>
          </span>
          <span className="text-xs text-slate-500 font-mono">({total} total documents)</span>
        </div>

        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3.5 top-3 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder={`Search ${selectedCol}...`}
            className="w-full bg-navy-950 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors"
          />
        </div>
      </div>

      {/* Collection Documents Table */}
      <div className="rounded-2xl bg-navy-900 border border-white/8 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="bg-white/2 border-b border-white/8 text-slate-400 font-medium">
                <th className="py-3 px-4 font-semibold">Document ID</th>
                <th className="py-3 px-4 font-semibold">Key Attributes</th>
                <th className="py-3 px-4 font-semibold text-right">Inspect JSON</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={3} className="py-12 text-center text-slate-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
                      <span>Reading collection documents...</span>
                    </div>
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-12 text-center text-slate-500">
                    No documents found in {selectedCol}.
                  </td>
                </tr>
              ) : (
                records.map((doc, idx) => {
                  const docId = doc.id || doc._id || `doc-${idx}`;
                  const keys = Object.keys(doc).filter(k => !['_id', 'password_hash'].includes(k)).slice(0, 5);
                  return (
                    <tr key={docId} className="hover:bg-white/2 transition-colors">
                      <td className="py-3 px-4 text-amber-300 font-bold max-w-[200px] truncate">
                        {String(docId)}
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        <div className="flex flex-wrap gap-2">
                          {keys.map((k) => (
                            <span key={k} className="px-2 py-0.5 rounded bg-white/4 border border-white/6 text-[11px]">
                              <strong className="text-slate-400">{k}:</strong> {String(doc[k]).slice(0, 28)}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setSelectedDoc(doc)}
                          className="px-2.5 py-1 rounded-lg bg-amber-400/10 hover:bg-amber-400/20 text-amber-300 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                        >
                          <FileJson size={13} />
                          <span>View JSON</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-white/8 flex items-center justify-between text-xs text-slate-400">
          <div>Showing {records.length} of {total} documents</div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 text-white"
            >
              Previous
            </button>
            <span className="font-mono text-amber-400 font-bold">Page {page}</span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page * 15 >= total}
              className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 text-white"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Document JSON Inspector Modal */}
      {selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade">
          <div className="w-full max-w-2xl p-6 rounded-2xl bg-navy-900 border border-white/10 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileJson size={16} className="text-amber-400" /> Document Viewer ({selectedCol})
              </h3>
              <button onClick={() => setSelectedDoc(null)} className="p-1 text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-navy-950 p-4 rounded-xl border border-white/8 font-mono text-xs text-cyan-300">
              <pre>{JSON.stringify(selectedDoc, null, 2)}</pre>
            </div>

            <div className="mt-4 flex justify-between items-center">
              <span className="text-[11px] text-slate-500 font-mono">
                {Object.keys(selectedDoc).length} total properties
              </span>
              <button
                onClick={() => setSelectedDoc(null)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-semibold"
              >
                Close Viewer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
